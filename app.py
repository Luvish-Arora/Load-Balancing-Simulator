from flask import Flask, render_template, jsonify, request
import random
import time

app = Flask(__name__)

class Task:
    def __init__(self, task_id, workload):
        self.id = task_id
        self.workload = workload
        self.assigned = False
        self.worker_id = None
        self.start_time = None
        self.end_time = None

class Worker:
    def __init__(self, worker_id):
        self.id = worker_id
        self.current_load = 0
        self.total_processed = 0
        self.tasks = []
        self.busy = False

class LoadBalancer:
    def __init__(self, num_workers, num_tasks, strategy):
        self.num_workers = num_workers
        self.num_tasks = num_tasks
        self.strategy = strategy
        self.workers = [Worker(i) for i in range(num_workers)]
        self.tasks = [Task(i, random.randint(1, 10)) for i in range(num_tasks)]
        self.current_step = 0
        self.completed_tasks = 0
        
    def assign_tasks(self):
        """Assign unassigned tasks based on strategy"""
        unassigned_tasks = [t for t in self.tasks if not t.assigned]
        
        for task in unassigned_tasks:
            selected_worker = None
            
            if self.strategy == 'round-robin':
                selected_worker = self.workers[task.id % self.num_workers]
            
            elif self.strategy == 'least-loaded':
                selected_worker = min(self.workers, key=lambda w: w.current_load)
            
            elif self.strategy == 'random':
                selected_worker = random.choice(self.workers)
            
            elif self.strategy == 'static':
                tasks_per_worker = (self.num_tasks + self.num_workers - 1) // self.num_workers
                worker_index = min(task.id // tasks_per_worker, self.num_workers - 1)
                selected_worker = self.workers[worker_index]
            
            # Assign task
            task.assigned = True
            task.worker_id = selected_worker.id
            task.start_time = self.current_step
            selected_worker.tasks.append(task.id)
            selected_worker.current_load += task.workload
    
    def process_step(self):
        """Process one time step"""
        # Assign any unassigned tasks first
        if any(not t.assigned for t in self.tasks):
            self.assign_tasks()
        
        # Process work for each worker
        for worker in self.workers:
            if worker.current_load > 0:
                work_done = 1
                worker.current_load = max(0, worker.current_load - work_done)
                worker.total_processed += work_done
                worker.busy = worker.current_load > 0
                
                # Check for completed tasks
                for task_id in worker.tasks:
                    task = self.tasks[task_id]
                    if task.end_time is None:
                        elapsed = self.current_step - task.start_time + 1
                        if elapsed >= task.workload:
                            task.end_time = self.current_step + 1
                            self.completed_tasks += 1
        
        self.current_step += 1
        
        return self.completed_tasks >= self.num_tasks
    
    def get_state(self):
        """Get current simulation state"""
        return {
            'workers': [
                {
                    'id': w.id,
                    'current_load': w.current_load,
                    'total_processed': w.total_processed,
                    'busy': w.busy,
                    'tasks': w.tasks
                } for w in self.workers
            ],
            'tasks': [
                {
                    'id': t.id,
                    'workload': t.workload,
                    'assigned': t.assigned,
                    'worker_id': t.worker_id,
                    'start_time': t.start_time,
                    'end_time': t.end_time
                } for t in self.tasks
            ],
            'current_step': self.current_step,
            'completed_tasks': self.completed_tasks
        }
    
    def calculate_metrics(self):
        """Calculate performance metrics"""
        completed = [t for t in self.tasks if t.end_time is not None]
        if not completed:
            return None
        
        completion_times = [t.end_time - t.start_time for t in completed]
        avg_completion = sum(completion_times) / len(completion_times)
        max_completion = max(completion_times)
        
        worker_loads = [w.total_processed for w in self.workers]
        avg_load = sum(worker_loads) / len(worker_loads)
        load_imbalance = max(worker_loads) - min(worker_loads)
        load_variance = sum((load - avg_load) ** 2 for load in worker_loads) / len(worker_loads)
        efficiency = (avg_load / max(worker_loads)) * 100 if max(worker_loads) > 0 else 0
        
        return {
            'total_time': self.current_step,
            'avg_completion': round(avg_completion, 2),
            'max_completion': max_completion,
            'load_imbalance': round(load_imbalance, 2),
            'load_variance': round(load_variance, 2),
            'efficiency': round(efficiency, 1)
        }

# Store simulations
simulations = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/start', methods=['POST'])
def start_simulation():
    data = request.json
    sim_id = str(time.time())
    
    balancer = LoadBalancer(
        num_workers=data['num_workers'],
        num_tasks=data['num_tasks'],
        strategy=data['strategy']
    )
    
    simulations[sim_id] = balancer
    
    return jsonify({
        'sim_id': sim_id,
        'state': balancer.get_state()
    })

@app.route('/api/step/<sim_id>', methods=['POST'])
def step_simulation(sim_id):
    if sim_id not in simulations:
        return jsonify({'error': 'Simulation not found'}), 404
    
    balancer = simulations[sim_id]
    is_complete = balancer.process_step()
    
    response = {
        'state': balancer.get_state(),
        'complete': is_complete
    }
    
    if is_complete:
        response['metrics'] = balancer.calculate_metrics()
    
    return jsonify(response)

@app.route('/api/reset/<sim_id>', methods=['POST'])
def reset_simulation(sim_id):
    if sim_id in simulations:
        del simulations[sim_id]
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(debug=True)