const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzJixAICDbkTqp8O5zEt0n_D_6wJgZumSz0VU6g6pBFibPDZb35VNrzslJW7GkzK9Q/exec';

document.addEventListener('DOMContentLoaded', () => {
    console.log("App Initializing...");

    // UI Elements
    const loginForm = document.getElementById('loginForm');
    const loginContainer = document.querySelector('.login-container');
    const dashboard = document.getElementById('dashboard');
    const welcomeText = document.getElementById('welcomeText');
    const userRole = document.getElementById('userRole');
    const logoutBtn = document.getElementById('logoutBtn');
    const activeTabTitle = document.getElementById('activeTabTitle');

    // Forms
    const dataForm = document.getElementById('dataForm'); // Tab 1
    const recvExcForm = document.getElementById('recvExcForm'); // Tab 2
    const floorWalkForm = document.getElementById('floorWalkForm'); // Tab 3

    // --- 1. Tab Navigation Logic ---
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanels = document.querySelectorAll('.tab-panel');

    if (navItems.length > 0) {
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const tabId = item.getAttribute('data-tab');
                console.log("Switching to tab:", tabId);
                
                if (tabId === 'performanceDashboardTab') {
                    if (typeof fetchDashboardData === 'function') fetchDashboardData();
                }
                if (tabId === 'adminDashboardTab') {
                    if (typeof fetchAdminDashboardData === 'function') fetchAdminDashboardData();
                }

                // Update Sidebar
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');

                // Update Panels
                tabPanels.forEach(panel => {
                    panel.classList.remove('active');
                    if (panel.id === tabId || panel.id === tabId + 'Tab') {
                        panel.classList.add('active');
                    }
                });

                // Update Header
                if (activeTabTitle) {
                    const navText = item.querySelector('.nav-text')?.textContent;
                    activeTabTitle.textContent = navText || "Dashboard";
                }
            });
        });
    }

    // --- 2. Login & Session Management ---
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('storeUser');
            location.reload(); // Hard reset for clean state
        });
    }


    const savedUser = localStorage.getItem('storeUser');
    if (savedUser) {
        try {
            showDashboard(JSON.parse(savedUser));
        } catch (e) {
            console.error("Session parse error", e);
            localStorage.removeItem('storeUser');
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('submitBtn');
            const btnText = submitBtn?.querySelector('.btn-text');
            const loader = submitBtn?.querySelector('.loader');
            const messageBox = document.getElementById('messageBox');

            setLoading(true, submitBtn, btnText, loader);
            if (messageBox) messageBox.classList.add('hidden');

            try {
                const empCode = document.getElementById('empCode')?.value;
                const password = document.getElementById('password')?.value;

                const url = new URL(SCRIPT_URL);
                url.searchParams.append('action', 'login');
                url.searchParams.append('empCode', empCode);
                url.searchParams.append('password', password);

                const response = await fetch(url.toString());
                const result = await response.json();

                if (result.status === 'success') {
                    localStorage.setItem('storeUser', JSON.stringify(result.user));
                    showDashboard(result.user);
                } else {
                    showMessage(messageBox, result.message || 'Login failed', 'error');
                }
            } catch (error) {
                console.error("Login Error:", error);
                showMessage(messageBox, 'Connection error. Please try again.', 'error');
            } finally {
                setLoading(false, submitBtn, btnText, loader);
            }
        });
    }

    // --- 3. Master Data Fetching ---
    let articleMaster = {};
    async function fetchArticleMaster() {
        try {
            const url = new URL(SCRIPT_URL);
            url.searchParams.append('action', 'getMasterData');
            url.searchParams.append('_', Date.now());

            const response = await fetch(url.toString());
            const result = await response.json();

            if (result.status === 'success') {
                articleMaster = result.data;
                const count = Object.keys(articleMaster || {}).length;
                updateMasterStatus(`Inventory: ${count} Items Ready ✓`, "success");
            } else {
                updateMasterStatus("Inventory Error: " + result.message, "error");
            }
        } catch (error) {
            console.error("Master Fetch Fail:", error);
            updateMasterStatus("Connection Error (Inventory)", "error");
            setTimeout(fetchArticleMaster, 10000);
        }
    }

    function updateMasterStatus(text, type) {
        let statusEl = document.getElementById('masterStatus');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'masterStatus';
            statusEl.className = 'status-indicator';
            document.body.appendChild(statusEl);
        }
        statusEl.textContent = text;
        statusEl.className = `status-indicator ${type}`;
    }

    fetchArticleMaster();

    // --- 3.5 Dashboard Analytics ---
    async function fetchDashboardData() {
        const totalEl = document.getElementById('dashTotalExceptions');
        const tbBody = document.getElementById('dashDateWiseTableBody');
        const refreshBtnTxt = document.getElementById('refreshDashText');
        
        if (!totalEl || !tbBody) return;

        try {
            if (refreshBtnTxt) refreshBtnTxt.textContent = "Loading Analytics...";
            
            const url = new URL(SCRIPT_URL);
            url.searchParams.append('action', 'getDashboardData');
            
            // Pass the currently logged-in user's ID
            const saved = localStorage.getItem('storeUser');
            if (saved) {
                try {
                    const user = JSON.parse(saved);
                    if (user && user.empCode) {
                        url.searchParams.append('empCode', user.empCode);
                    }
                } catch(e) {}
            }

            url.searchParams.append('_', Date.now());

            const response = await fetch(url.toString());
            const result = await response.json();

            if (result.status === 'success') {
                totalEl.textContent = result.data.total;
                
                // Populate Table
                tbBody.innerHTML = '';
                const dWise = result.data.dateWise;
                if (Object.keys(dWise).length === 0) {
                    tbBody.innerHTML = '<tr><td colspan="2" style="padding: 20px; text-align: center; color: var(--grey-500);">No data found</td></tr>';
                } else {
                    for (const [date, count] of Object.entries(dWise)) {
                        const tr = document.createElement('tr');
                        tr.style.background = 'white';
                        tr.style.cursor = 'default';
                        tr.addEventListener('mouseenter', () => tr.style.background = 'var(--grey-50)');
                        tr.addEventListener('mouseleave', () => tr.style.background = 'white');
                        
                        const tdDate = document.createElement('td');
                        tdDate.style.padding = '12px';
                        tdDate.style.borderBottom = '1px solid var(--grey-200)';
                        tdDate.style.color = 'var(--text-dark)';
                        tdDate.textContent = date;
                        
                        const tdCount = document.createElement('td');
                        tdCount.style.padding = '12px';
                        tdCount.style.borderBottom = '1px solid var(--grey-200)';
                        tdCount.style.textAlign = 'center';
                        tdCount.style.fontWeight = '600';
                        tdCount.style.color = 'var(--blue-main)';
                        tdCount.textContent = count;
                        
                        tr.appendChild(tdDate);
                        tr.appendChild(tdCount);
                        tbBody.appendChild(tr);
                    }
                }

                // Populate Module Table
                const modTbBody = document.getElementById('dashModuleWiseTableBody');
                if (modTbBody) {
                    modTbBody.innerHTML = '';
                    const mWise = result.data.moduleWise || {};
                    if (Object.keys(mWise).length === 0) {
                        modTbBody.innerHTML = '<tr><td colspan="2" style="padding: 20px; text-align: center; color: var(--grey-500);">No data found</td></tr>';
                    } else {
                        for (const [moduleName, count] of Object.entries(mWise)) {
                            const tr = document.createElement('tr');
                            tr.style.background = 'white';
                            tr.style.cursor = 'default';
                            tr.addEventListener('mouseenter', () => tr.style.background = 'var(--grey-50)');
                            tr.addEventListener('mouseleave', () => tr.style.background = 'white');
                            
                            const tdName = document.createElement('td');
                            tdName.style.padding = '12px';
                            tdName.style.borderBottom = '1px solid var(--grey-200)';
                            tdName.style.color = 'var(--text-dark)';
                            tdName.textContent = moduleName;
                            
                            const tdCount = document.createElement('td');
                            tdCount.style.padding = '12px';
                            tdCount.style.borderBottom = '1px solid var(--grey-200)';
                            tdCount.style.textAlign = 'center';
                            tdCount.style.fontWeight = '600';
                            tdCount.style.color = 'var(--blue-main)';
                            tdCount.textContent = count;
                            
                            tr.appendChild(tdName);
                            tr.appendChild(tdCount);
                            modTbBody.appendChild(tr);
                        }
                    }
                }
            } else {
                totalEl.textContent = "Error";
                tbBody.innerHTML = `<tr><td colspan="2" style="padding: 20px; text-align: center; color: #d32f2f;">Error loading data: ${result.message}</td></tr>`;
            }
        } catch (error) {
            console.error("Dashboard Fetch Fail:", error);
            totalEl.textContent = "Offline";
            tbBody.innerHTML = '<tr><td colspan="2" style="padding: 20px; text-align: center; color: #d32f2f;">Connection Error. Check internet or redeploy.</td></tr>';
        } finally {
            if (refreshBtnTxt) refreshBtnTxt.textContent = "Refresh Analytics";
        }
    }

    const refreshDashboardBtn = document.getElementById('refreshDashboardBtn');
    if (refreshDashboardBtn) {
        refreshDashboardBtn.addEventListener('click', fetchDashboardData);
    }

    // --- 3.6 Admin Dashboard System ---
    let fullAdminExceptionData = [];

    async function fetchAdminDashboardData() {
        const btnRefresh = document.getElementById('btnAdminRefresh');
        if (btnRefresh) btnRefresh.textContent = "Loading...";

        try {
            const url = new URL(SCRIPT_URL);
            url.searchParams.append('action', 'getDashboardData');
            url.searchParams.append('isAdmin', 'true');
            url.searchParams.append('_', Date.now());

            const res = await fetch(url.toString());
            const json = await res.json();

            if (json.status === 'success' && json.data.adminData) {
                fullAdminExceptionData = json.data.adminData;
                applyAdminFilters(); // Renders the dashboard
            } else {
                console.error("Admin fetch failed:", json.message);
            }
        } catch (e) {
            console.error("Error fetching admin data", e);
        } finally {
            if (btnRefresh) btnRefresh.textContent = "↻ Refresh";
        }
    }

    function applyAdminFilters() {
        if (!fullAdminExceptionData) return;

        const dateFilter = document.getElementById('adminDateFilter')?.value || 'all';
        let filteredData = fullAdminExceptionData;

        // Custom Date Handling
        document.getElementById('adminCustomDateBox')?.classList.toggle('hidden', dateFilter !== 'custom');

        const today = new Date();
        today.setHours(0,0,0,0);

        if (dateFilter !== 'all' && dateFilter !== 'custom') {
            filteredData = fullAdminExceptionData.filter(item => {
                if (!item.date || item.date === 'Unknown Date') return false;
                const d = new Date(item.date);
                if (isNaN(d.getTime())) return false;
                d.setHours(0,0,0,0);
                
                const diffTime = today - d;
                const diffDays = diffTime / (1000 * 60 * 60 * 24);

                if (dateFilter === 'today') return diffDays === 0;
                if (dateFilter === 'yesterday') return diffDays === 1;
                if (dateFilter === '7days') return diffDays >= 0 && diffDays <= 7;
                if (dateFilter === '30days') return diffDays >= 0 && diffDays <= 30;
                return true;
            });
        } else if (dateFilter === 'custom') {
            const dFrom = new Date(document.getElementById('adminDateFrom')?.value || 0);
            const dTo = new Date(document.getElementById('adminDateTo')?.value || 0);
            if (!isNaN(dFrom) && !isNaN(dTo)) {
                filteredData = fullAdminExceptionData.filter(item => {
                   const d = new Date(item.date);
                   return d >= dFrom && d <= dTo;
                });
            }
        }

        renderAdminDashboard(filteredData);
    }

    function renderAdminDashboard(data) {
        // Summary
        const uniqueStores = new Set(data.map(i => i.store)).size;
        const uniqueLPAs = new Set(data.map(i => i.lpa)).size;
        const totalValue = data.reduce((sum, i) => sum + i.value, 0);

        const setTxt = (id, val) => { if (document.getElementById(id)) document.getElementById(id).textContent = val; };
        setTxt('adTotalStores', uniqueStores);
        setTxt('adTotalLPAs', uniqueLPAs);
        setTxt('adTotalCount', data.length);
        setTxt('adTotalValue', totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

        // Aggregation Helpers
        const aggregate = (keyExtractor) => {
            const map = {};
            data.forEach(item => {
                const ky = keyExtractor(item);
                if (!map[ky]) map[ky] = { count: 0, val: 0 };
                map[ky].count++;
                map[ky].val += item.value;
            });
            return Object.entries(map).map(e => ({ name: e[0], count: e[1].count, val: e[1].val })).sort((a,b) => b.count - a.count);
        };

        const generateTableRows = (arr, tbodyId, type) => {
            const tbody = document.getElementById(tbodyId);
            if (!tbody) return;
            tbody.innerHTML = '';
            arr.slice(0, 50).forEach(row => { // Limit for UI performance
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--grey-200)';
                if (type) {
                    tr.style.cursor = 'pointer';
                    tr.title = "Click to drill down";
                    tr.addEventListener('mouseenter', () => tr.style.background = 'var(--grey-50)');
                    tr.addEventListener('mouseleave', () => tr.style.background = 'transparent');
                    tr.addEventListener('click', () => showAdminDrillModal(type, row.name, data));
                }
                tr.innerHTML = `
                    <td style="padding: 10px; ${type ? 'color: var(--blue-main); font-weight: 600;' : ''}">${row.name}</td>
                    <td style="padding: 10px;">${row.count}</td>
                    <td style="padding: 10px; font-weight: 500;">₹${row.val.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                `;
                tbody.appendChild(tr);
            });
        };

        // Render Lists
        generateTableRows(aggregate(i => i.module || 'Unknown'), 'adModuleList', 'module');
        generateTableRows(aggregate(i => i.category || 'Unknown'), 'adCategoryList', 'category');
        generateTableRows(aggregate(i => i.store || 'Unknown'), 'adTopStoresList', 'store');
        generateTableRows(aggregate(i => `${i.lpa} (${i.empCode || 'Unknown'})`), 'adTopLPAsList', 'lpa');
    }

    function showAdminDrillModal(filterType, filterName, data) {
        const modal = document.getElementById('adminDrillModal');
        const mTitle = document.getElementById('adminModalTitle');
        const mBody = document.getElementById('adminModalBody');
        if (!modal || !mTitle || !mBody) return;

        let items = [];
        if (filterType === 'store') items = data.filter(i => i.store === filterName);
        if (filterType === 'module') items = data.filter(i => (i.module || 'Unknown') === filterName);
        if (filterType === 'category') items = data.filter(i => (i.category || 'Unknown') === filterName);
        if (filterType === 'lpa') items = data.filter(i => `${i.lpa} (${i.empCode || 'Unknown'})` === filterName);

        mTitle.textContent = `Exception Details: ${filterName} (${items.length} records)`;
        
        mBody.innerHTML = '';
        items.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 10px; border-bottom: 1px solid var(--grey-200);">${item.date}</td>
                <td style="padding: 10px; border-bottom: 1px solid var(--grey-200);">${item.module || 'Unknown'}</td>
                <td style="padding: 10px; border-bottom: 1px solid var(--grey-200);">${item.store}</td>
                <td style="padding: 10px; border-bottom: 1px solid var(--grey-200);">${item.lpa}</td>
                <td style="padding: 10px; border-bottom: 1px solid var(--grey-200);">${item.category}</td>
                <td style="padding: 10px; border-bottom: 1px solid var(--grey-200); font-weight: 500;">₹${item.value}</td>
            `;
            mBody.appendChild(tr);
        });

        modal.classList.remove('hidden');
    }

    // Admin Interactivity Listeners
    document.getElementById('adminCloseModal')?.addEventListener('click', () => document.getElementById('adminDrillModal').classList.add('hidden'));
    document.getElementById('btnAdminRefresh')?.addEventListener('click', fetchAdminDashboardData);
    document.getElementById('adminDateFilter')?.addEventListener('change', applyAdminFilters);
    document.getElementById('btnAdminApplyDate')?.addEventListener('click', applyAdminFilters);

    document.getElementById('btnAdminExportCSV')?.addEventListener('click', () => {
        if (!fullAdminExceptionData || fullAdminExceptionData.length === 0) return alert('No data to export.');
        
        const headers = ["Date", "Store", "LPA", "EmpCode", "Category", "Value"];
        const csvContent = [headers.join(',')];
        
        fullAdminExceptionData.forEach(item => {
            const row = [
                `"${item.date}"`, `"${item.store}"`, `"${item.lpa}"`, 
                `"${item.empCode}"`, `"${item.category}"`, `${item.value}`
            ];
            csvContent.push(row.join(','));
        });

        const blob = new Blob([csvContent.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Admin_Exceptions_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // --- 4. Reusable Lookup Helper ---
    function setupLookup(form, mapInputName, onCalc) {
        if (!form) return;
        const artInput = form.querySelector('[name="ArticleCode"]');
        const enaInput = form.querySelector('[name="EnaCode"]') || form.querySelector('[name="EanCode"]');
        const descInput = form.querySelector('[name="ArticleDescription"]');
        const mapInput = form.querySelector(`[name="${mapInputName}"]`);

        async function doLookup(val) {
            if (!articleMaster || !val) return;
            const item = articleMaster[val.toString().trim()];
            if (item) {
                if (descInput) descInput.value = item.desc || "";
                if (mapInput) mapInput.value = item.map || 0;
                // Sync the other code field
                if (artInput && item.code && artInput.value.trim() !== String(item.code)) artInput.value = item.code;
                if (enaInput && item.ena && enaInput.value.trim() !== String(item.ena)) enaInput.value = item.ena;

                if (onCalc) onCalc();
            }
        }

        [artInput, enaInput].forEach(inp => {
            if (inp) {
                inp.addEventListener('input', (e) => {
                    if (!e.target.value.trim()) {
                        if (descInput) descInput.value = "";
                        if (mapInput) mapInput.value = "";
                        return;
                    }
                    doLookup(e.target.value);
                });
            }
        });
    }

    // --- 5. Tab 1: Vehicle Data (Math Only) ---
    if (dataForm) {
        const huTotal = document.getElementById('huQty');
        const huGot = document.getElementById('huReceived');
        const huShort = document.getElementById('huShort');
        const siteCodeSel = document.getElementById('siteCode');
        const siteNameInp = document.getElementById('siteName');

        const siteMap = {
            'TXVP': 'Raj Theatre Property',
            'TB18': 'Subbarao Property'
        };

        if (siteCodeSel && siteNameInp) {
            siteCodeSel.addEventListener('input', () => {
                siteNameInp.value = siteMap[siteCodeSel.value] || "";
            });
        }

        [huTotal, huGot].forEach(inp => {
            if (inp) {
                inp.addEventListener('input', () => {
                    const total = parseFloat(huTotal?.value) || 0;
                    const got = parseFloat(huGot?.value) || 0;
                    if (huShort) huShort.value = Math.max(0, total - got);
                });
            }
        });

        dataForm.addEventListener('submit', (e) => handleGenericSubmit(e, dataForm, 'saveData', 'formMessage', 'submitDataBtn'));
    }

    // --- 6. Tab 2: Receiving Exceptions ---
    if (recvExcForm) {
        function calcRecvBlock(itemBlock) {
            const map = parseFloat(itemBlock.querySelector('[name="MapPerPiece"]')?.value) || 0;
            const hu = parseFloat(itemBlock.querySelector('[name="HuQty"]')?.value) || 0;
            const recv = parseFloat(itemBlock.querySelector('[name="ReceivedQty"]')?.value) || 0;
            const dmg = parseFloat(itemBlock.querySelector('[name="Damaged"]')?.value) || 0;
            const nExp = parseFloat(itemBlock.querySelector('[name="NearExpired"]')?.value) || 0;
            const exp = parseFloat(itemBlock.querySelector('[name="Expired"]')?.value) || 0;

            const diff = recv - hu;
            const exc = diff > 0 ? diff : 0;
            const shrt = diff < 0 ? Math.abs(diff) : 0;

            const setVal = (name, val) => {
                const el = itemBlock.querySelector(`[name="${name}"]`);
                if (el) el.value = val;
            };

            setVal('Excess', exc);
            setVal('Short', shrt);
            setVal('ExcessVal', (exc * map).toFixed(2));
            setVal('ShortVal', (shrt * map).toFixed(2));
            setVal('DamageVal', (dmg * map).toFixed(2));
            setVal('NearExpiryVal', (nExp * map).toFixed(2));

            const totalEaches = exc + shrt + dmg + nExp + exp;
            setVal('NoOfDiscrepantEaches', totalEaches);
            setVal('TotalValue', (totalEaches * map).toFixed(2));
        }

        function setupRecvItemEvents(block) {
            setupLookup(block, 'MapPerPiece', () => calcRecvBlock(block));
            block.querySelectorAll('input').forEach(i => i.addEventListener('input', () => calcRecvBlock(block)));
        }

        const itemsContainer = document.getElementById('recvItemsContainer');
        const noOfExceptionInput = document.getElementById('excNoOfException');
        
        let initialItemTemplate = null;
        if (itemsContainer) {
             const firstItem = itemsContainer.querySelector('.recv-item-block');
             initialItemTemplate = firstItem.cloneNode(true);
             setupRecvItemEvents(firstItem);
        }

        if (noOfExceptionInput && itemsContainer) {
            noOfExceptionInput.addEventListener('input', () => {
                let count = parseInt(noOfExceptionInput.value) || 1;
                if (count < 1) count = 1;
                if (count > 20) count = 20;
                
                const currentBlocks = itemsContainer.querySelectorAll('.recv-item-block');
                const diff = count - currentBlocks.length;
                
                if (diff > 0) {
                    for (let i = 0; i < diff; i++) {
                        const newBlock = initialItemTemplate.cloneNode(true);
                        const index = currentBlocks.length + i + 1;
                        const title = newBlock.querySelector('.item-block-title');
                        if (title) {
                            title.textContent = `Item ${index}`;
                            title.style.display = 'block';
                        }
                        // Clear template values
                        newBlock.querySelectorAll('input:not([type="button"])').forEach(input => input.value = '');
                        newBlock.querySelectorAll('select').forEach(sel => sel.value = '');
                        setupRecvItemEvents(newBlock);
                        itemsContainer.appendChild(newBlock);
                    }
                } else if (diff < 0) {
                    for (let i = 0; i < Math.abs(diff); i++) {
                        itemsContainer.removeChild(itemsContainer.lastElementChild);
                    }
                }
                
                if (typeof initCameraScanner === 'function') initCameraScanner();
            });
        }

        function setupAutoFill(form) {
            if (!form) return;
            const tripInput = form.querySelector('[name="TripNumber"]') || form.querySelector('[name="TripNo"]');
            const invInput = form.querySelector('[name="InvoiceNumber"]');

            const fieldsToFill = {
                'TripDate': ['TripDate', 'Date'],
                'TripNo': ['TripNo'],
                'VehicleNo': ['VehicleNo'],
                'SendingSite': ['SendingSite', 'SendingSiteCode'],
                'SiteCode': ['SiteCode']
            };

            function doAutoFill(searchVal, searchKey) {
                if (!searchVal) return;
                const history = JSON.parse(localStorage.getItem('vehicleDataHistory') || '[]');
                const match = history.slice().reverse().find(entry =>
                    String(entry[searchKey] || "").trim() === searchVal.trim()
                );

                if (match) {
                    Object.keys(fieldsToFill).forEach(targetName => {
                        const el = form.querySelector(`[name="${targetName}"]`);
                        if (el && (!el.value || el.value === '')) {
                            const sourceKeys = fieldsToFill[targetName];
                            for (let sKey of sourceKeys) {
                                if (match[sKey]) {
                                    if (el.type === 'date') el.value = match[sKey].split('T')[0].split(' ')[0];
                                    else el.value = match[sKey];
                                    break;
                                }
                            }
                        }
                    });
                }
            }
            if (tripInput) tripInput.addEventListener('input', () => doAutoFill(tripInput.value, 'TripNo'));
            if (invInput) invInput.addEventListener('input', () => doAutoFill(invInput.value, 'InvoiceNumber'));
        }

        setupAutoFill(recvExcForm);

        recvExcForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const msgEl = document.getElementById('recvExcMessage');
            const btn = document.getElementById('submitRecvExcBtn');
            const btnTxt = btn?.querySelector('.btn-text');
            const loader = btn?.querySelector('.loader');

            setLoading(true, btn, btnTxt, loader);
            if (msgEl) msgEl.classList.add('hidden');

            const blocks = itemsContainer.querySelectorAll('.recv-item-block');
            const noOfItems = parseInt(noOfExceptionInput.value) || 1;
            
            // Gather shared data
            const commonData = {};
            const sharedInputs = recvExcForm.querySelectorAll('input:not(.recv-item-block input), select:not(.recv-item-block select)');
            sharedInputs.forEach(inp => { if(inp.name) commonData[inp.name] = inp.value; });

            const user = JSON.parse(localStorage.getItem('storeUser'));
            const submittedBy = user ? user.empCode : "User";
            commonData['Timestamp'] = new Date().toLocaleString();
            commonData['SubmittedBy'] = submittedBy;
            commonData['action'] = 'saveRecvException';
            commonData['NoOfException'] = noOfItems; 

            // Extract items
            const itemsToSubmit = [];
            for (let b = 0; b < blocks.length; b++) {
                const block = blocks[b];
                const itemData = { ...commonData };
                let missingItem = false;
                
                block.querySelectorAll('input, select').forEach(inp => {
                    if (inp.name) itemData[inp.name] = inp.value;
                    if (inp.hasAttribute('required') && !inp.value && inp.value !== 0) missingItem = true;
                });
                
                if (!itemData.ArticleCode && !itemData.EnaCode) missingItem = true;
                
                if (missingItem) {
                    setLoading(false, btn, btnTxt, loader);
                    showMessage(msgEl, `Missing information in Item ${b + 1} (Article Code/Values)`, "error");
                    return;
                }
                itemsToSubmit.push(itemData);
            }

            try {
                let anyError = false;
                let errorMsg = '';
                for (const itemData of itemsToSubmit) {
                    const params = new URLSearchParams();
                    Object.keys(itemData).forEach(k => params.append(k, itemData[k]));
                    const res = await fetch(`${SCRIPT_URL}?${params.toString()}`, { method: 'GET', mode: 'cors' });
                    const json = await res.json();
                    if (json.status !== 'success') {
                        anyError = true;
                        errorMsg = json.message;
                    }
                }
                
                if (anyError) {
                    showMessage(msgEl, "Error saving items: " + errorMsg, "error");
                } else {
                    showMessage(msgEl, "Saved entirely successfully!", "success");
                    recvExcForm.reset();
                    noOfExceptionInput.value = "1";
                    noOfExceptionInput.dispatchEvent(new Event('input')); // resets to single block
                }
            } catch (err) {
                console.error("Save error", err);
                showMessage(msgEl, "Connection failed", "error");
            } finally {
                setLoading(false, btn, btnTxt, loader);
            }
        });
    }

    // --- 7. Tab 3: Floor Walk ---
    if (floorWalkForm) {
        function calcFW() {
            const map = parseFloat(floorWalkForm.querySelector('[name="EaValueMap"]')?.value) || 0;
            const qty = parseFloat(floorWalkForm.querySelector('[name="Quantity"]')?.value) || 0;
            const val = qty * map;

            const valEl = floorWalkForm.querySelector('[name="CalculatedValue"]');
            if (valEl) valEl.value = val.toFixed(2);

            const tQtyEl = floorWalkForm.querySelector('[name="TotalQty"]');
            const tValEl = floorWalkForm.querySelector('[name="TotalValue"]');
            if (tQtyEl) tQtyEl.value = qty;
            if (tValEl) tValEl.value = val.toFixed(2);
        }

        setupLookup(floorWalkForm, 'EaValueMap', calcFW);
        floorWalkForm.querySelectorAll('input').forEach(i => i.addEventListener('input', calcFW));
        floorWalkForm.addEventListener('submit', (e) => handleGenericSubmit(e, floorWalkForm, 'saveFloorWalk', 'floorWalkMessage', 'submitFloorWalkBtn'));
    }

    // --- 8. Tab 4: Register Validation ---
    const regValForm = document.getElementById('regValForm');
    const rvBusinessType = document.getElementById('rvBusinessType');
    const rvRegisterName = document.getElementById('rvRegisterName');

    const registerLists = {
        'Store': [
            "DAD Register", "Dump Register", "Loose Conversion Register",
            "Markdown Register", "Incident Register", "Store Opening & Closing Register",
            "CN Register", "Duplicate Register", "High Value Register",
            "Bulk Register", "Float Register", "CMS Register",
            "HOTO Register", "General Inward Register", "Diesel Inward Register",
            "F&V PI Register"
        ],
        'Jiomart': [
            "Cash Register", "CN Register", "Duplicate Register",
            "Jiomart Trip Register", "Rider Attempted Register"
        ]
    };

    if (rvBusinessType && rvRegisterName) {
        rvBusinessType.addEventListener('change', () => {
            const type = rvBusinessType.value;
            rvRegisterName.innerHTML = '<option value="">-- Select Register --</option>';

            if (type && registerLists[type]) {
                rvRegisterName.disabled = false;
                registerLists[type].forEach(reg => {
                    const opt = document.createElement('option');
                    opt.value = reg;
                    opt.textContent = reg;
                    rvRegisterName.appendChild(opt);
                });
            } else {
                rvRegisterName.disabled = true;
                rvRegisterName.innerHTML = '<option value="">-- Choose Business Type First --</option>';
            }
        });
    }

    if (regValForm) {
        const registersWithItems = ['Dump Register', 'DAD Register', 'Loose Conversion Register', 'Markdown Register', 'F&V PI Register'];

        function calcRVBlock(block) {
            const map = parseFloat(block.querySelector('[name="MapPerPiece"]')?.value) || 0;
            const regQty = parseFloat(block.querySelector('[name="RegisterQty"]')?.value) || 0;
            const docQty = parseFloat(block.querySelector('[name="DocumentQuantity"]')?.value) || 0;
            const selectedReg = rvRegisterName ? rvRegisterName.value : '';

            // Exception Qty = Register Qty - Document Qty (can be positive or negative)
            const excQty = regQty - docQty;
            const excVal = excQty * map;

            const excQtyEl = block.querySelector('[name="ExceptionQty"]');
            const excValEl = block.querySelector('[name="ExceptionValue"]');
            const remarksEl = block.querySelector('[name="OthersRemarks"]'); 

            if (excQtyEl) excQtyEl.value = excQty;
            if (excValEl) excValEl.value = excVal.toFixed(2);
            
            // Auto Remarks based on Exception Quantity Difference
            if (remarksEl) {
                const currentRemark = remarksEl.value;
                const isAuto = !currentRemark || currentRemark.includes("Posting") || currentRemark === "Matched" || currentRemark === "Register Update Missing";
                
                if (isAuto) {
                    if (excQty !== 0) {
                        if (registersWithItems.includes(selectedReg)) {
                            remarksEl.value = (excQty < 0) ? "Excess Posting" : "Short Posting";
                        } else {
                            remarksEl.value = "Register Update Missing";
                        }
                    } else if (regQty > 0 || docQty > 0) {
                        remarksEl.value = "Matched";
                    } else {
                        remarksEl.value = ""; // clear if both are 0
                    }
                }
            }
        }

        function setupRVItemEvents(block) {
            setupLookup(block, 'MapPerPiece', () => calcRVBlock(block));
            block.querySelectorAll('input').forEach(i => i.addEventListener('input', () => calcRVBlock(block)));
        }

        const rvItemsContainer = document.getElementById('regValItemsContainer');
        const rvNoOfExceptionInput = document.getElementById('rvNoOfException');
        
        let rvInitialItemTemplate = null;
        if (rvItemsContainer) {
             const firstItem = rvItemsContainer.querySelector('.reg-val-item-block');
             rvInitialItemTemplate = firstItem.cloneNode(true);
             setupRVItemEvents(firstItem);
        }

        if (rvNoOfExceptionInput && rvItemsContainer) {
            rvNoOfExceptionInput.addEventListener('input', () => {
                let count = parseInt(rvNoOfExceptionInput.value) || 1;
                if (count < 1) count = 1;
                if (count > 20) count = 20;
                
                const currentBlocks = rvItemsContainer.querySelectorAll('.reg-val-item-block');
                const diff = count - currentBlocks.length;
                
                if (diff > 0) {
                    for (let i = 0; i < diff; i++) {
                        const newBlock = rvInitialItemTemplate.cloneNode(true);
                        const index = currentBlocks.length + i + 1;
                        const title = newBlock.querySelector('.rv-item-block-title');
                        if (title) {
                            title.textContent = `Item ${index} Details`;
                        }
                        // Clear template values
                        newBlock.querySelectorAll('input').forEach(input => input.value = '');
                        setupRVItemEvents(newBlock);
                        rvItemsContainer.appendChild(newBlock);
                    }
                } else if (diff < 0) {
                    for (let i = 0; i < Math.abs(diff); i++) {
                        rvItemsContainer.removeChild(rvItemsContainer.lastElementChild);
                    }
                }
                
                // Re-sync item identification visibility for new blocks
                if (rvRegisterName) rvRegisterName.dispatchEvent(new Event('change'));
                if (typeof initCameraScanner === 'function') initCameraScanner();
            });
        }
        
        // Dynamically show/hide "Item Identification" depending on selected register type
        if (rvRegisterName) {
            rvRegisterName.addEventListener('change', () => {
                const selectedReg = rvRegisterName.value;
                const blocks = rvItemsContainer.querySelectorAll('.reg-val-item-block');
                
                blocks.forEach(block => {
                    const itemSection = block.querySelector('.rv-item-id-section');
                    const regQtyInput = block.querySelector('[name="RegisterQty"]');
                    const docQtyInput = block.querySelector('[name="DocumentQuantity"]');
                    const isMatch = registersWithItems.includes(selectedReg);
                    
                    console.log(`Register Validation: ${selectedReg} matched for item details? ${isMatch}`);

                    if (isMatch) {
                        if (itemSection) itemSection.style.display = 'block';
                        if (regQtyInput) regQtyInput.setAttribute('step', '0.001');
                        if (docQtyInput) docQtyInput.setAttribute('step', '0.001');
                    } else {
                        if (itemSection) itemSection.style.display = 'none';
                        if (regQtyInput) regQtyInput.setAttribute('step', '1');
                        if (docQtyInput) docQtyInput.setAttribute('step', '1');
                        
                        // Clear the hidden item fields
                        const inputsToClear = ['ArticleCode', 'EanCode', 'ArticleDescription', 'MapPerPiece'];
                        inputsToClear.forEach(name => {
                            const el = block.querySelector(`[name="${name}"]`);
                            if (el) el.value = '';
                        });
                    }
                    calcRVBlock(block);
                });
            });
        }
        
        regValForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const msgEl = document.getElementById('regValMessage');
            const btn = document.getElementById('submitRegValBtn');
            const btnTxt = btn?.querySelector('.btn-text');
            const loader = btn?.querySelector('.loader');

            setLoading(true, btn, btnTxt, loader);
            if (msgEl) msgEl.classList.add('hidden');

            const blocks = rvItemsContainer.querySelectorAll('.reg-val-item-block');
            const noOfItems = parseInt(rvNoOfExceptionInput.value) || 1;
            const selectedReg = rvRegisterName ? rvRegisterName.value : '';
            const isItemReg = registersWithItems.includes(selectedReg);
            
            // Gather shared data
            const commonData = {};
            const sharedInputs = regValForm.querySelectorAll('input:not(.reg-val-item-block input), select:not(.reg-val-item-block select)');
            sharedInputs.forEach(inp => { if(inp.name) commonData[inp.name] = inp.value; });

            const user = JSON.parse(localStorage.getItem('storeUser'));
            const submittedBy = user ? user.empCode : "User";
            commonData['Timestamp'] = new Date().toLocaleString();
            commonData['SubmittedBy'] = submittedBy;
            commonData['action'] = 'saveRegisterValidation';
            commonData['NoOfException'] = noOfItems; 

            // Extract items
            const itemsToSubmit = [];
            for (let b = 0; b < blocks.length; b++) {
                const block = blocks[b];
                const itemData = { ...commonData };
                let missingItem = false;
                
                block.querySelectorAll('input, select').forEach(inp => {
                    if (inp.name) itemData[inp.name] = inp.value;
                    if (inp.hasAttribute('required') && !inp.value && inp.value !== 0) missingItem = true;
                });
                
                if (isItemReg && !itemData.ArticleCode && !itemData.EanCode) missingItem = true;
                
                if (missingItem) {
                    setLoading(false, btn, btnTxt, loader);
                    showMessage(msgEl, `Missing information in Item ${b + 1}`, "error");
                    return;
                }
                itemsToSubmit.push(itemData);
            }

            try {
                let anyError = false;
                let errorMsg = '';
                for (const itemData of itemsToSubmit) {
                    const params = new URLSearchParams();
                    Object.keys(itemData).forEach(k => params.append(k, itemData[k]));
                    const res = await fetch(`${SCRIPT_URL}?${params.toString()}`, { method: 'GET', mode: 'cors' });
                    const json = await res.json();
                    if (json.status !== 'success') {
                        anyError = true;
                        errorMsg = json.message;
                    }
                }
                
                if (anyError) {
                    showMessage(msgEl, "Error saving entries: " + errorMsg, "error");
                } else {
                    showMessage(msgEl, "Saved successfully!", "success");
                    regValForm.reset();
                    rvNoOfExceptionInput.value = "1";
                    rvNoOfExceptionInput.dispatchEvent(new Event('input')); 
                    if (rvBusinessType) rvBusinessType.dispatchEvent(new Event('change'));
                }
            } catch (err) {
                console.error("Save error", err);
                showMessage(msgEl, "Connection failed", "error");
            } finally {
                setLoading(false, btn, btnTxt, loader);
            }
        });
    }

    // --- 9. Tab 5: QC & JioMart Exception ---
    const qcJioForm = document.getElementById('qcJioForm');
    if (qcJioForm) {
        function calcQJBlock(block) {
            const map = parseFloat(block.querySelector('[name="MapPerPiece"]')?.value) || 0;
            const invQty = parseFloat(block.querySelector('[name="InvoiceQty"]')?.value) || 0;
            const packQty = parseFloat(block.querySelector('[name="PackQty"]')?.value) || 0;
            const damaged = parseFloat(block.querySelector('[name="Damaged"]')?.value) || 0;
            const nearExp = parseFloat(block.querySelector('[name="NearExpired"]')?.value) || 0;
            const expired = parseFloat(block.querySelector('[name="Expired"]')?.value) || 0;

            const diff = packQty - invQty;
            const excess = diff > 0 ? diff : 0;
            const short = diff < 0 ? Math.abs(diff) : 0;

            const excessEl = block.querySelector('[name="Excess"]');
            const shortEl = block.querySelector('[name="Short"]');
            if (excessEl) excessEl.value = excess || '';
            if (shortEl) shortEl.value = short || '';

            const exVal = excess * map;
            const shVal = short * map;
            const dmVal = damaged * map;
            const neVal = nearExp * map;
            const erVal = expired * map;

            const totalQty = excess + short + damaged + nearExp + expired;
            const totalVal = exVal + shVal + dmVal + neVal + erVal;

            const fields = {
                'ExcessVal': exVal,
                'ShortVal': shVal,
                'DamageVal': dmVal,
                'NearExpiryVal': neVal,
                'ExpireVal': erVal,
                'TotalDiscrepantEaches': totalQty,
                'TotalValue': totalVal
            };
            for (let [name, val] of Object.entries(fields)) {
                const el = block.querySelector(`[name="${name}"]`);
                if (el) el.value = val ? val.toFixed(2).replace(/\.00$/, '') : '';
            }
        }

        function setupQJItemEvents(block) {
            setupLookup(block, 'MapPerPiece', () => calcQJBlock(block));
            block.querySelectorAll('[name="InvoiceQty"],[name="PackQty"],.qj-calc-trigger')
                 .forEach(i => i.addEventListener('input', () => calcQJBlock(block)));
        }

        const qjItemsContainer = document.getElementById('qcJioItemsContainer');
        const qjNoOfExceptionInput = document.getElementById('qcNoOfException');
        
        let qjItemTemplate = null;
        if (qjItemsContainer) {
            const firstBlock = qjItemsContainer.querySelector('.qc-jio-item-block');
            if (firstBlock) {
                qjItemTemplate = firstBlock.cloneNode(true);
                setupQJItemEvents(firstBlock);
            }
        }

        if (qjNoOfExceptionInput && qjItemsContainer) {
            qjNoOfExceptionInput.addEventListener('input', () => {
                let count = parseInt(qjNoOfExceptionInput.value) || 1;
                if (count < 1) count = 1;
                if (count > 20) count = 20;

                const currentBlocks = qjItemsContainer.querySelectorAll('.qc-jio-item-block');
                const diff = count - currentBlocks.length;

                if (diff > 0) {
                    for (let i = 0; i < diff; i++) {
                        const newBlock = qjItemTemplate.cloneNode(true);
                        const index = currentBlocks.length + i + 1;
                        const title = newBlock.querySelector('.qc-item-block-title');
                        if (title) title.textContent = `Item ${index} Identification`;
                        
                        newBlock.querySelectorAll('input:not([type="button"])').forEach(input => input.value = '');
                        setupQJItemEvents(newBlock);
                        qjItemsContainer.appendChild(newBlock);
                    }
                } else if (diff < 0) {
                    for (let i = 0; i < Math.abs(diff); i++) {
                        if (qjItemsContainer.children.length > 1) {
                            qjItemsContainer.removeChild(qjItemsContainer.lastElementChild);
                        }
                    }
                }
            });
        }

        // Handle Virtual CN Radio toggles
        const vcnRadios = qcJioForm.querySelectorAll('[name="VirtualCN"]');
        const qcRemarks = qcJioForm.querySelector('[name="Remarks"]');

        if (vcnRadios.length > 0) {
            vcnRadios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    if (e.target.value === 'yes') {
                        if (qjItemsContainer) qjItemsContainer.style.display = 'none';
                        if (qcRemarks) qcRemarks.value = 'Virtual CN generated';
                        alert("Virtual CN generated");
                    } else {
                        if (qjItemsContainer) qjItemsContainer.style.display = 'block';
                        if (qcRemarks && qcRemarks.value === 'Virtual CN generated') {
                            qcRemarks.value = ''; 
                        }
                    }
                });
            });
        }

        qcJioForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const msgEl = document.getElementById('qcJioMessage');
            const btn = document.getElementById('submitQcJioBtn');
            const btnTxt = btn?.querySelector('.btn-text');
            const loader = btn?.querySelector('.loader');

            setLoading(true, btn, btnTxt, loader);
            if (msgEl) msgEl.classList.add('hidden');

            const isVirtual = qcJioForm.querySelector('[name="VirtualCN"]:checked')?.value === 'yes';
            const blocks = qjItemsContainer.querySelectorAll('.qc-jio-item-block');
            const noOfItems = parseInt(qjNoOfExceptionInput.value) || 1;

            // Gather shared data
            const commonData = {};
            const sharedInputs = qcJioForm.querySelectorAll('input:not(.qc-jio-item-block input), select:not(.qc-jio-item-block select)');
            sharedInputs.forEach(inp => { 
                if (inp.name && inp.type !== 'radio') commonData[inp.name] = inp.value;
                if (inp.type === 'radio' && inp.checked) commonData[inp.name] = inp.value;
            });

            const user = JSON.parse(localStorage.getItem('storeUser'));
            const submittedBy = user ? user.empCode : "User";
            commonData['Timestamp'] = new Date().toLocaleString();
            commonData['SubmittedBy'] = submittedBy;
            commonData['action'] = 'saveQcJio';
            commonData['NoOfException'] = noOfItems;

            const itemsToSubmit = [];
            
            if (isVirtual) {
                // If Virtual CN, just send common data once (or one dummy item)
                itemsToSubmit.push({ ...commonData });
            } else {
                for (let b = 0; b < blocks.length; b++) {
                    const block = blocks[b];
                    const itemData = { ...commonData };
                    let missingItem = false;
                    
                    block.querySelectorAll('input, select').forEach(inp => {
                        if (inp.name) itemData[inp.name] = inp.value;
                    });
                    
                    if (!itemData.ArticleCode && !itemData.EanCode) missingItem = true;
                    
                    if (missingItem) {
                        setLoading(false, btn, btnTxt, loader);
                        showMessage(msgEl, `Missing information in Item ${b + 1}`, "error");
                        return;
                    }
                    itemsToSubmit.push(itemData);
                }
            }

            try {
                let anyError = false;
                let errorMsg = '';
                for (const itemData of itemsToSubmit) {
                    const params = new URLSearchParams();
                    Object.keys(itemData).forEach(k => params.append(k, itemData[k]));
                    const res = await fetch(`${SCRIPT_URL}?${params.toString()}`, { method: 'GET', mode: 'cors' });
                    const json = await res.json();
                    if (json.status !== 'success') {
                        anyError = true;
                        errorMsg = json.message;
                    }
                }
                
                if (anyError) {
                    showMessage(msgEl, "Error saving entries: " + errorMsg, "error");
                } else {
                    showMessage(msgEl, "Saved successfully!", "success");
                    qcJioForm.reset();
                    qjNoOfExceptionInput.value = "1";
                    qjNoOfExceptionInput.dispatchEvent(new Event('input'));
                    // Re-trigger radio toggle reset if needed
                    qcJioForm.querySelector('[name="VirtualCN"][value="no"]').click();
                }
            } catch (err) {
                console.error("Save error", err);
                showMessage(msgEl, "Connection failed", "error");
            } finally {
                setLoading(false, btn, btnTxt, loader);
            }
        });
    }

    // --- 10. Tab 6: Fashion & Footwear Exceptions ---
    const fashionForm = document.getElementById('fashionForm');
    if (fashionForm) {
        function calcFF() {
            const map = parseFloat(fashionForm.querySelector('[name="MapPerPiece"]')?.value) || 0;
            const nhQty = parseFloat(fashionForm.querySelector('[name="NoHardtagQty"]')?.value) || 0;
            const dmQty = parseFloat(fashionForm.querySelector('[name="DamagedQty"]')?.value) || 0;
            const grQty = parseFloat(fashionForm.querySelector('[name="GrazingQty"]')?.value) || 0;

            const nhVal = nhQty * map;
            const dmVal = dmQty * map;
            const grVal = grQty * map;
            const totalVal = nhVal + dmVal + grVal;

            const fields = {
                'NoHardtagVal': nhVal,
                'DamageVal': dmVal,
                'GrazingVal': grVal,
                'TotalValue': totalVal
            };

            for (let [name, val] of Object.entries(fields)) {
                const el = fashionForm.querySelector(`[name="${name}"]`);
                if (el) el.value = val.toFixed(2).replace(/\.00$/, '');
            }
        }

        setupLookup(fashionForm, 'MapPerPiece', calcFF);
        fashionForm.querySelectorAll('.ff-calc-trigger').forEach(i => i.addEventListener('input', calcFF));
        fashionForm.addEventListener('submit', (e) => handleGenericSubmit(e, fashionForm, 'saveFashion', 'fashionMessage', 'submitFashionBtn', ['Timestamp', 'SubmittedBy', 'StoreCode', 'Date', 'LpaName', 'Location']));
    }

    // --- 11. Tab 7: Unbilled & Thefting Exceptions ---
    if (unbilledForm) {
        const typeSelect = document.getElementById('utExceptionType');
        const unbilledSec = document.getElementById('unbilledSection');
        const theftingSec = document.getElementById('theftingSection');

        typeSelect?.addEventListener('change', () => {
            const val = typeSelect.value;
            unbilledSec.classList.add('hidden');
            theftingSec.classList.add('hidden');

            if (val === 'Unbilled') unbilledSec.classList.remove('hidden');
            else if (val === 'Thefting') theftingSec.classList.remove('hidden');
        });

        function calcUTBlock(block) {
            const map = parseFloat(block.querySelector('[name="MapPerPiece"]')?.value) || 0;
            const qty = parseFloat(block.querySelector('[name="Quantity"]')?.value) || 0;
            const total = qty * map;

            const totalEl = block.querySelector('[name="TotalValue"]');
            if (totalEl) totalEl.value = total.toFixed(2).replace(/\.00$/, '');
        }

        function setupUTBlockEvents(block) {
            setupLookup(block, 'MapPerPiece', () => calcUTBlock(block));
            block.querySelector('[name="Quantity"]')?.addEventListener('input', () => calcUTBlock(block));
        }

        const utItemsContainer = document.getElementById('utItemsContainer');
        const utNoOfExceptionInput = document.getElementById('utNoOfException');
        
        let utItemTemplate = null;
        if (utItemsContainer) {
            const firstBlock = utItemsContainer.querySelector('.ut-item-block');
            if (firstBlock) {
                utItemTemplate = firstBlock.cloneNode(true);
                setupUTBlockEvents(firstBlock);
            }
        }

        if (utNoOfExceptionInput && utItemsContainer) {
            utNoOfExceptionInput.addEventListener('input', () => {
                let count = parseInt(utNoOfExceptionInput.value) || 1;
                count = Math.max(1, Math.min(20, count));

                const currentBlocks = utItemsContainer.querySelectorAll('.ut-item-block');
                const diff = count - currentBlocks.length;

                if (diff > 0) {
                    for (let i = 0; i < diff; i++) {
                        const newBlock = utItemTemplate.cloneNode(true);
                        const index = currentBlocks.length + i + 1;
                        const title = newBlock.querySelector('.ut-item-block-title');
                        if (title) title.textContent = `Item ${index} Details`;
                        
                        newBlock.querySelectorAll('input:not([type="button"])').forEach(input => input.value = '');
                        newBlock.querySelectorAll('select').forEach(sel => sel.selectedIndex = 0);
                        setupUTBlockEvents(newBlock);
                        utItemsContainer.appendChild(newBlock);
                    }
                } else if (diff < 0) {
                    for (let i = 0; i < Math.abs(diff); i++) {
                        if (utItemsContainer.children.length > 1) {
                            utItemsContainer.removeChild(utItemsContainer.lastElementChild);
                        }
                    }
                }
            });
        }

        unbilledForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const msgEl = document.getElementById('unbilledMessage');
            const btn = document.getElementById('submitUnbilledBtn');
            const btnTxt = btn?.querySelector('.btn-text');
            const loader = btn?.querySelector('.loader');

            setLoading(true, btn, btnTxt, loader);
            if (msgEl) msgEl.classList.add('hidden');

            const blocks = utItemsContainer.querySelectorAll('.ut-item-block');
            const commonData = {};
            const sharedInputs = unbilledForm.querySelectorAll('input:not(.ut-item-block input), select:not(.ut-item-block select)');
            sharedInputs.forEach(inp => { 
                if (inp.name && inp.type !== 'radio') commonData[inp.name] = inp.value;
                if (inp.type === 'radio' && inp.checked) commonData[inp.name] = inp.value;
            });

            const user = JSON.parse(localStorage.getItem('storeUser'));
            commonData['Timestamp'] = new Date().toLocaleString();
            commonData['SubmittedBy'] = user ? user.empCode : "User";
            commonData['action'] = 'saveIncident'; 
            commonData['NoOfException'] = parseInt(utNoOfExceptionInput.value) || 1;

            const itemsToSubmit = [];
            for (let b = 0; b < blocks.length; b++) {
                const block = blocks[b];
                const itemData = { ...commonData };
                
                block.querySelectorAll('input, select').forEach(inp => {
                    if (inp.name) itemData[inp.name] = inp.value;
                });
                
                if (!itemData.ArticleCode && !itemData.EanCode) {
                    setLoading(false, btn, btnTxt, loader);
                    showMessage(msgEl, `Missing Article/EAN for Item ${b+1}`, "error");
                    return;
                }
                itemsToSubmit.push(itemData);
            }

            try {
                let anyError = false;
                let errorMsg = '';
                for (const itemData of itemsToSubmit) {
                    const params = new URLSearchParams();
                    Object.keys(itemData).forEach(k => params.append(k, itemData[k]));
                    const res = await fetch(`${SCRIPT_URL}?${params.toString()}`, { method: 'GET', mode: 'cors' });
                    const json = await res.json();
                    if (json.status !== 'success') { anyError = true; errorMsg = json.message; }
                }
                
                if (anyError) showMessage(msgEl, "Error saving: " + errorMsg, "error");
                else {
                    showMessage(msgEl, "Saved successfully!", "success");
                    unbilledForm.reset();
                    utNoOfExceptionInput.value = "1";
                    utNoOfExceptionInput.dispatchEvent(new Event('input'));
                    // Hide dynamic sections
                    unbilledSec.classList.add('hidden');
                    theftingSec.classList.add('hidden');
                }
            } catch (err) {
                console.error(err);
                showMessage(msgEl, "Connection failed", "error");
            } finally {
                setLoading(false, btn, btnTxt, loader);
            }
        });
    }

    // --- Generic Submit Handler ---
    async function handleGenericSubmit(e, form, action, msgId, btnId, headerOrder = []) {
        e.preventDefault();
        const msgEl = document.getElementById(msgId);
        const btn = document.getElementById(btnId);
        const btnTxt = btn?.querySelector('.btn-text');
        const loader = btn?.querySelector('.loader');

        setLoading(true, btn, btnTxt, loader);
        if (msgEl) msgEl.classList.add('hidden');

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Validation
        const missing = [];
        for (let [key, val] of formData.entries()) {
            if (['ArticleCode', 'EnaCode', 'EanCode'].includes(key)) continue;
            
            // For Unbilled tab, ignore fields that are currently hidden
            if (form.id === 'unbilledForm') {
                const type = data.ExceptionType;
                if (type === 'Unbilled' && ['CustomerName', 'CustomerGender', 'LocationFound'].includes(key)) continue;
                if (type === 'Thefting') {
                    if (['EmpName', 'EmpID', 'BilledNo', 'RposID'].includes(key)) continue;
                    // Custom validation since native HTML required was removed
                    if (key === 'LocationFound' && !val) {
                        missing.push("location found");
                        continue;
                    }
                }
            }

            if (form.querySelector(`[name="${key}"]`)?.hasAttribute('required') && !val && val !== 0) {
                const label = form.querySelector(`[name="${key}"]`)?.previousElementSibling?.textContent || key;
                missing.push(label);
            }
        }
        let skipArticleCheck = form.id === 'dataForm';
        
        // Skip Article Code validation for non-item registers in Register Validation
        if (form.id === 'regValForm') {
            const registersWithItems = ['Dump Register', 'DAD Register', 'Loose Conversion Register', 'Markdown Register', 'F&V PI Register'];
            if (!registersWithItems.includes(data.RegisterName)) {
                skipArticleCheck = true;
            }
        }

        // Skip Article Code validation for QC Jio form if Virtual CN IS Yes
        if (form.id === 'qcJioForm') {
            if (data.VirtualCN === 'yes') {
                skipArticleCheck = true;
            }
        }

        if (!data.ArticleCode && !data.EnaCode && !data.EanCode && !skipArticleCheck) {
            missing.push("Article/ENA Code");
        }

        if (missing.length > 0) {
            setLoading(false, btn, btnTxt, loader);
            showMessage(msgEl, "Missing: " + missing.join(", "), "error");
            return;
        }

        const user = JSON.parse(localStorage.getItem('storeUser'));
        const submittedBy = user ? user.empCode : "User";
        const timestamp = new Date().toLocaleString();

        // Build the submission payload in specified order if headerOrder is provided
        const finalData = {};
        if (headerOrder.length > 0) {
            headerOrder.forEach(key => {
                if (key === 'Timestamp') finalData[key] = timestamp;
                else if (key === 'SubmittedBy') finalData[key] = submittedBy;
                else finalData[key] = data[key] || "";
            });
            // Add remaining fields (don't repeat Timestamp/SubmittedBy)
            Object.keys(data).forEach(key => {
                if (!headerOrder.includes(key) && key !== 'Timestamp' && key !== 'SubmittedBy') {
                    finalData[key] = data[key];
                }
            });
        } else {
            finalData.Timestamp = timestamp;
            finalData.SubmittedBy = submittedBy;
            Object.assign(finalData, data);
        }

        finalData.action = action;

        try {
            const baseUrl = SCRIPT_URL;
            const params = new URLSearchParams();
            Object.keys(finalData).forEach(k => params.append(k, finalData[k]));

            const res = await fetch(`${baseUrl}?${params.toString()}`, {
                method: 'GET',
                mode: 'cors'
            });
            const json = await res.json();
            if (json.status === 'success') {
                showMessage(msgEl, "Saved successfully!", "success");

                // Cache successful Vehicle Data submissions locally for quick lookup
                if (action === 'saveData') {
                    const history = JSON.parse(localStorage.getItem('vehicleDataHistory') || '[]');
                    history.push(finalData);
                    if (history.length > 50) history.shift(); // Keep last 50
                    localStorage.setItem('vehicleDataHistory', JSON.stringify(history));
                }

                form.reset();
                
                // Re-populate LPA Name & Store Code after reset
                const lpaInput = form.querySelector('input[name="LPA"], input[name="LpaName"], input[name="CheckingLpaName"]');
                if (lpaInput && user && (user.name || user.empCode)) {
                    lpaInput.value = user.name || user.empCode;
                }
                
                // NOTE: We deliberately do NOT call resetFormDates() here.
                // Date fields left blank after reset so the USER must choose
                // the correct date for each new entry — past or present.
            } else {
                showMessage(msgEl, "Error: " + json.message, "error");
            }
        } catch (err) {
            console.error("Save error", err);
            showMessage(msgEl, "Connection failed", "error");
        } finally {
            setLoading(false, btn, btnTxt, loader);
        }
    }

    // --- Helpers ---
    function setLoading(loading, btn, txt, ldr) {
        if (!btn) return;
        btn.disabled = loading;
        if (txt) txt.style.display = loading ? 'none' : 'inline';
        if (ldr) ldr.style.display = loading ? 'block' : 'none';
        if (ldr) ldr.classList.toggle('hidden', !loading);
    }

    function showMessage(el, text, type) {
        if (!el) return;
        el.textContent = text;
        el.className = `message-box ${type}`;
        el.classList.remove('hidden');
        if (type === 'success') setTimeout(() => el.classList.add('hidden'), 5000);
    }

    function showDashboard(user) {
        if (loginContainer) loginContainer.classList.add('hidden');
        if (dashboard) dashboard.classList.remove('hidden');
        
        if (welcomeText) welcomeText.textContent = user.name || user.empCode || 'User';
        if (userRole) userRole.textContent = user.role || 'Staff';

        // Role-based Layout Switcher
        const normTab = document.getElementById('navNormalDashboard');
        const adminTab = document.getElementById('navAdminDashboard');
        
        const role = String(user.role || '').trim().toLowerCase();

        if (role === 'admin') {
            if (normTab) normTab.classList.add('hidden');
            if (adminTab) {
                adminTab.classList.remove('hidden');
                setTimeout(() => adminTab.click(), 100);
            }
        } else {
            if (normTab) normTab.classList.remove('hidden');
            if (adminTab) adminTab.classList.add('hidden');
        }

        resetFormDates();
        initCameraScanner();

        // --- Auto-populate LPA Name & Store Code ---
        const lpaInputs = document.querySelectorAll('input[name="LPA"], input[name="LpaName"], input[name="CheckingLpaName"]');
        lpaInputs.forEach(input => {
            if (user && (user.name || user.empCode)) {
                input.value = user.name || user.empCode;
                input.readOnly = true;
                input.style.backgroundColor = 'var(--grey-50)';
                input.style.color = 'var(--text-dark)';
                input.style.fontWeight = '600';
                input.style.cursor = 'not-allowed';
                input.title = "Auto-filled based on login";
            }
        });
    }

    // ============================================
    // CAMERA BARCODE SCANNER
    // ============================================
    function initCameraScanner() {
        document.querySelectorAll('.scan-btn:not([data-scanner-init="true"])').forEach(btn => {
            btn.setAttribute('data-scanner-init', 'true');
            btn.addEventListener('click', async () => {
                const targetName = btn.getAttribute('data-target');
                const form = btn.closest('form');
                if (!form) return;

                // Create live scanner overlay
                const overlay = document.createElement('div');
                overlay.id = 'scanOverlay';
                overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;';
                
                const scannerContainer = document.createElement('div');
                scannerContainer.id = 'scanner-view';
                scannerContainer.style.cssText = 'width:100%; max-width:400px; aspect-ratio:1/1; border-radius:12px; border: 2px solid #3b82f6; background: #111; overflow: hidden;';
                
                const hint = document.createElement('p');
                hint.textContent = '📷 Initializing camera...';
                hint.style.cssText = 'color:white;margin-top:20px;font-size:14px;text-align:center;font-family: sans-serif;';
                
                const legacyBtn = document.createElement('button');
                legacyBtn.textContent = '📸 Camera not opening? Use Photo Mode';
                legacyBtn.style.cssText = 'margin-top:15px;padding:12px 20px;background:rgba(255,255,255,0.1);color:white;border:1px solid #555;border-radius:10px;font-size:14px;cursor:pointer;';

                const closeBtn = document.createElement('button');
                closeBtn.textContent = '✕ Close';
                closeBtn.style.cssText = 'margin-top:30px;padding:12px 40px;background:#ef4444;color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;';

                overlay.appendChild(scannerContainer);
                overlay.appendChild(hint);
                overlay.appendChild(legacyBtn);
                overlay.appendChild(closeBtn);
                document.body.appendChild(overlay);

                const html5QrCode = new Html5Qrcode("scanner-view");
                
                const stopScanner = async () => {
                    try { if (html5QrCode.isScanning) await html5QrCode.stop(); } catch(e){}
                    overlay.remove();
                };

                closeBtn.onclick = stopScanner;

                const onScanSuccess = (decodedText) => {
                    const targetEl = form.querySelector(`[name="${targetName}"]`);
                    if (targetEl) {
                        targetEl.value = decodedText;
                        targetEl.dispatchEvent(new Event('input'));
                    }
                    stopScanner();
                };

                // Legacy Mode Handler
                legacyBtn.onclick = async () => {
                    const fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.accept = 'image/*';
                    fileInput.capture = 'environment';
                    fileInput.onchange = async () => {
                        if (!fileInput.files[0]) return;
                        hint.textContent = '🔍 Scanning photo...';
                        try {
                            const result = await html5QrCode.scanFile(fileInput.files[0], true);
                            onScanSuccess(result);
                        } catch(err) {
                            alert("No barcode found in photo. Please ensure it's clear and try again.");
                            hint.textContent = '❌ No barcode found.';
                        }
                    };
                    fileInput.click();
                };

                try {
                    await html5QrCode.start(
                        { facingMode: "environment" }, 
                        { fps: 15, qrbox: { width: 250, height: 150 } }, 
                        onScanSuccess
                    );
                    hint.textContent = '✅ Live Camera Active. Center barcode in square.';
                } catch (err) {
                    console.error("Live camera failed", err);
                    hint.textContent = '⚠️ Live camera blocked. Click "Photo Mode" below.';
                    legacyBtn.style.background = '#3b82f6';
                    legacyBtn.style.border = 'none';
                }
            });
        });
    }

    function resetFormDates() {
        // This only runs ONCE on login/dashboard load.
        // It sets today as the default starting point — but the user can
        // freely change any date field to any past or future date.
        // It does NOT run after form submission to avoid overwriting user intent.
        const today = new Date().toISOString().split('T')[0];
        document.querySelectorAll('input[type="date"]').forEach(inp => {
            // Only fill date if the field has no value set at all
            if (!inp.value) {
                inp.value = today;
            }
        });
    }
});
