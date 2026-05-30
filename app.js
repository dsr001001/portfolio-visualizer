let charts = {};

document.getElementById('csvFileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('fileName').textContent = file.name;
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');

    Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: function(results) {
            const data = results.data;
            processData(data);
        },
        error: function(error) {
            console.error("Error parsing CSV:", error);
            alert("Error parsing CSV file.");
            document.getElementById('loading').classList.add('hidden');
        }
    });
});

function formatCurrency(value) {
    if (value >= 1000000) return '$' + (value / 1000000).toFixed(2) + 'M';
    if (value >= 1000) return '$' + (value / 1000).toFixed(2) + 'K';
    return '$' + value.toFixed(2);
}

function processData(data) {
    // 1. Group Data by Month
    const monthlyData = {};
    const latestMonth = data.reduce((max, row) => row.reporting_month > max ? row.reporting_month : max, "");
    
    // For specific views
    const productsLatest = {};
    let latestAccounts = new Set();
    let latestBalance = 0;
    let latestSpend = 0;

    data.forEach(row => {
        const month = row.reporting_month;
        if (!monthlyData[month]) {
            monthlyData[month] = {
                balance: 0,
                spend: 0,
                revolve: 0,
                delinquency: {}
            };
        }
        
        monthlyData[month].balance += (row.balance || 0);
        monthlyData[month].spend += (row.spend || 0);
        monthlyData[month].revolve += (row.revolve_balance || 0);
        
        const dq = row.delinquency_bucket || 'Current';
        monthlyData[month].delinquency[dq] = (monthlyData[month].delinquency[dq] || 0) + (row.balance || 0);

        // Capture latest month data for KPIs and Pie Chart
        if (month === latestMonth) {
            latestAccounts.add(row.account_id);
            latestBalance += (row.balance || 0);
            latestSpend += (row.spend || 0);
            
            const prod = row.product || 'Unknown';
            productsLatest[prod] = (productsLatest[prod] || 0) + 1;
        }
    });

    // 2. Update KPIs
    document.getElementById('kpiAccounts').textContent = latestAccounts.size.toLocaleString();
    document.getElementById('kpiBalance').textContent = formatCurrency(latestBalance);
    document.getElementById('kpiSpend').textContent = formatCurrency(latestSpend);

    // 3. Prepare Chart Data Arrays (Sorted by Month)
    const sortedMonths = Object.keys(monthlyData).sort();
    const balances = sortedMonths.map(m => monthlyData[m].balance);
    const spends = sortedMonths.map(m => monthlyData[m].spend);
    const revolves = sortedMonths.map(m => monthlyData[m].revolve);

    // 4. Render Charts
    renderBalanceChart(sortedMonths, balances);
    renderSpendRevolveChart(sortedMonths, spends, revolves);
    renderDelinquencyChart(sortedMonths, monthlyData);
    renderProductChart(productsLatest);

    // Show Dashboard
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
}

function destroyChart(id) {
    if (charts[id]) {
        charts[id].destroy();
    }
}

function renderBalanceChart(labels, data) {
    destroyChart('balanceChart');
    const ctx = document.getElementById('balanceChart').getContext('2d');
    charts['balanceChart'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Balance',
                data: data,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Total Portfolio Balance Over Time' } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function renderSpendRevolveChart(labels, spendData, revolveData) {
    destroyChart('spendRevolveChart');
    const ctx = document.getElementById('spendRevolveChart').getContext('2d');
    charts['spendRevolveChart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Spend',
                    data: spendData,
                    backgroundColor: '#10b981'
                },
                {
                    label: 'Revolve Balance',
                    data: revolveData,
                    backgroundColor: '#f59e0b'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Spend vs Revolve Balance' } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function renderDelinquencyChart(labels, monthlyData) {
    destroyChart('delinquencyChart');
    const categories = ['1-29 DPD', '30-59 DPD', '60-89 DPD', '90+ DPD', 'Charge-off'];
    const colors = ['#fde047', '#facc15', '#fb923c', '#ef4444', '#7f1d1d'];
    
    const datasets = categories.map((cat, i) => {
        return {
            label: cat,
            data: labels.map(m => monthlyData[m].delinquency[cat] || 0),
            backgroundColor: colors[i]
        };
    });

    const ctx = document.getElementById('delinquencyChart').getContext('2d');
    charts['delinquencyChart'] = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Delinquency Balances (Excl. Current)' } },
            scales: {
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true }
            }
        }
    });
}

function renderProductChart(productData) {
    destroyChart('productChart');
    const labels = Object.keys(productData);
    const data = Object.values(productData);
    
    const ctx = document.getElementById('productChart').getContext('2d');
    charts['productChart'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Product Mix (Latest Month)' } }
        }
    });
}