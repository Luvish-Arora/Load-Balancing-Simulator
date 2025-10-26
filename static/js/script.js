let simId = null;
let isRunning = false;
let intervalId = null;

const elements = {
    strategy: document.getElementById('strategy'),
    workers: document.getElementById('workers'),
    tasks: document.getElementById('tasks'),
    workersValue: document.getElementById('workers-value'),
    tasksValue: document.getElementById('tasks-value'),
    startBtn: document.getElementById('startBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    resetBtn: document.getElementById('resetBtn'),
    step: document.getElementById('step'),
    completed: document.getElementById('completed'),
    total: document.getElementById('total'),
    workersContainer: document.getElementById('workers-container'),
    tasksContainer: document.getElementById('tasks-container'),
    metricsPanel: document.getElementById('metrics-panel'),
    metricsContainer: document.getElementById('metrics-container')
};

// Update range value displays
elements.workers.addEventListener('input', (e) => {
    elements.workersValue.textContent = e.target.value;
});

elements.tasks.addEventListener('input', (e) => {
    elements.tasksValue.textContent = e.target.value;
    elements.total.textContent = e.target.value;
});

// Start simulation
elements.startBtn.addEventListener('click', async () => {
    const config = {
        num_workers: parseInt(elements.workers.value),
        num_tasks: parseInt(elements.tasks.value),
        strategy: elements.strategy.value
    };

    const response = await fetch('/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    });

    const data = await response.json();
    simId = data.sim_id;
    
    updateUI(data.state);
    startAnimation();
    
    elements.startBtn.disabled = true;
    elements.pauseBtn.disabled = false;
    elements.strategy.disabled = true;
    elements.workers.disabled = true;
    elements.tasks.disabled = true;
    elements.metricsPanel.style.display = 'none';
});

// Pause simulation
elements.pauseBtn.addEventListener('click', () => {
    if (isRunning) {
        stopAnimation();
        elements.pauseBtn.textContent = '▶ Resume';
    } else {
        startAnimation();
        elements.pauseBtn.textContent = '⏸ Pause';
    }
});

// Reset simulation
elements.resetBtn.addEventListener('click', async () => {
    if (simId) {
        await fetch(`/api/reset/${simId}`, { method: 'POST' });
    }
    
    stopAnimation();
    simId = null;
    
    elements.step.textContent = '0';
    elements.completed.textContent = '0';
    elements.workersContainer.innerHTML = '';
    elements.tasksContainer.innerHTML = '';
    elements.metricsPanel.style.display = 'none';
    
    elements.startBtn.disabled = false;
    elements.pauseBtn.disabled = true;
    elements.pauseBtn.textContent = '⏸ Pause';
    elements.strategy.disabled = false;
    elements.workers.disabled = false;
    elements.tasks.disabled = false;
});

function startAnimation() {
    isRunning = true;
    intervalId = setInterval(processStep, 500);
}

function stopAnimation() {
    isRunning = false;
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

async function processStep() {
    if (!simId) return;

    const response = await fetch(`/api/step/${simId}`, { method: 'POST' });
    const data = await response.json();

    updateUI(data.state);

    if (data.complete) {
        stopAnimation();
        showMetrics(data.metrics);
        elements.pauseBtn.disabled = true;
    }
}

function updateUI(state) {
    elements.step.textContent = state.current_step;
    elements.completed.textContent = state.completed_tasks;

    // Update workers
    const maxProcessed = Math.max(...state.workers.map(w => w.total_processed), 1);
    elements.workersContainer.innerHTML = state.workers.map(worker => {
        const loadPercent = (worker.total_processed / maxProcessed) * 100;
        const busyClass = worker.busy ? 'worker-busy' : 'worker-idle';
        
        return `
            <div class="worker">
                <div class="worker-header">
                    <span class="worker-name">Worker ${worker.id}</span>
                    <span class="worker-stats">Load: ${worker.current_load} | Processed: ${worker.total_processed}</span>
                </div>
                <div class="worker-bar">
                    <div class="worker-progress ${busyClass}" style="width: ${loadPercent}%"></div>
                </div>
            </div>
        `;
    }).join('');

    // Update tasks
    elements.tasksContainer.innerHTML = state.tasks.map(task => {
        let taskClass = 'task-unassigned';
        let details = '';
        
        if (task.end_time !== null) {
            taskClass = 'task-completed';
            details = `→ Worker ${task.worker_id} (${task.end_time - task.start_time}s)`;
        } else if (task.assigned) {
            taskClass = 'task-processing';
            details = `→ Worker ${task.worker_id}`;
        }
        
        return `
            <div class="task ${taskClass}">
                <div class="task-header">
                    <span>Task ${task.id}</span>
                    <span>Load: ${task.workload}</span>
                </div>
                ${details ? `<div class="task-details">${details}</div>` : ''}
            </div>
        `;
    }).join('');
}

function showMetrics(metrics) {
    elements.metricsPanel.style.display = 'block';
    elements.metricsContainer.innerHTML = `
        <div class="metric-card">
            <div class="metric-label">Total Time</div>
            <div class="metric-value">${metrics.total_time}s</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Avg Completion</div>
            <div class="metric-value">${metrics.avg_completion}s</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Max Completion</div>
            <div class="metric-value">${metrics.max_completion}s</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Load Imbalance</div>
            <div class="metric-value">${metrics.load_imbalance}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Load Variance</div>
            <div class="metric-value">${metrics.load_variance}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Efficiency</div>
            <div class="metric-value">${metrics.efficiency}%</div>
        </div>
    `;
}