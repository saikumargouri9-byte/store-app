const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz09YNGwroATWO42s0Bn1SBoVnLg1XmwQYNEzH38fDu6ZJe_u2oK5Iv8syWJW6tYoQ/exec';

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
            'TXVP': 'Smart Hub - TXVP',
            'TB18': 'Digital Store - TB18'
        };

        if (siteCodeSel && siteNameInp) {
            siteCodeSel.addEventListener('change', () => {
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
        function calcRecv() {
            const map = parseFloat(recvExcForm.querySelector('[name="MapPerPiece"]')?.value) || 0;
            const hu = parseFloat(recvExcForm.querySelector('[name="HuQty"]')?.value) || 0;
            const recv = parseFloat(recvExcForm.querySelector('[name="ReceivedQty"]')?.value) || 0;
            const dmg = parseFloat(recvExcForm.querySelector('[name="Damaged"]')?.value) || 0;
            const nExp = parseFloat(recvExcForm.querySelector('[name="NearExpired"]')?.value) || 0;
            const exp = parseFloat(recvExcForm.querySelector('[name="Expired"]')?.value) || 0;

            const diff = recv - hu;
            const exc = diff > 0 ? diff : 0;
            const shrt = diff < 0 ? Math.abs(diff) : 0;

            const setVal = (name, val) => {
                const el = recvExcForm.querySelector(`[name="${name}"]`);
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

        setupLookup(recvExcForm, 'MapPerPiece', calcRecv);
        recvExcForm.querySelectorAll('input').forEach(i => i.addEventListener('input', calcRecv));

        // Auto-fill TripDate, VehicleNo, and STNNo based on TripNo
        const recvTripNo = recvExcForm.querySelector('[name="TripNo"]');
        if (recvTripNo) {
            recvTripNo.addEventListener('input', () => {
                const searchTrip = recvTripNo.value.trim();
                if (!searchTrip) return;

                let match = null;
                // 1. Check local storage history (previously submitted)
                const history = JSON.parse(localStorage.getItem('vehicleDataHistory') || '[]');
                match = history.slice().reverse().find(entry => entry.TripNo === searchTrip);

                // 2. Check current active Vehicle Data form if not found in history
                if (!match && document.getElementById('dataForm')) {
                    const dataForm = document.getElementById('dataForm');
                    const activeTrip = dataForm.querySelector('[name="TripNo"]')?.value.trim();
                    if (activeTrip && activeTrip === searchTrip) {
                        match = {
                            Date: dataForm.querySelector('[name="Date"]')?.value,
                            VehicleNo: dataForm.querySelector('[name="VehicleNo"]')?.value,
                            STNNumber: dataForm.querySelector('[name="STNNumber"]')?.value,
                            InvoiceNumber: dataForm.querySelector('[name="InvoiceNumber"]')?.value,
                            InwardNumber: dataForm.querySelector('[name="InwardNumber"]')?.value
                        };
                    }
                }

                if (match) {
                    const tDate = recvExcForm.querySelector('[name="TripDate"]');
                    const vNo = recvExcForm.querySelector('[name="VehicleNo"]');
                    const stn = recvExcForm.querySelector('[name="STNNo"]');

                    if (tDate && match.Date) tDate.value = match.Date.split('T')[0].split(' ')[0];
                    if (vNo && match.VehicleNo) vNo.value = match.VehicleNo;
                    if (stn && !stn.value) {
                        stn.value = match.STNNumber || match.InvoiceNumber || match.InwardNumber || '';
                    }
                }
            });
        }

        recvExcForm.addEventListener('submit', (e) => handleGenericSubmit(e, recvExcForm, 'saveRecvException', 'recvExcMessage', 'submitRecvExcBtn'));
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
            "HOTO Register", "General Inward Register", "Desial Inward register"
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
        function calcRV() {
            const map = parseFloat(regValForm.querySelector('[name="MapPerPiece"]')?.value) || 0;
            const regQty = parseFloat(regValForm.querySelector('[name="RegisterQty"]')?.value) || 0;
            const docQty = parseFloat(regValForm.querySelector('[name="DocumentQuantity"]')?.value) || 0;

            // Exception Qty = Register Qty - Document Qty (can be positive or negative)
            const excQty = regQty - docQty;
            const excVal = excQty * map;

            const excQtyEl = regValForm.querySelector('[name="ExceptionQty"]');
            const excValEl = regValForm.querySelector('[name="ExceptionValue"]');

            if (excQtyEl) excQtyEl.value = excQty;
            if (excValEl) excValEl.value = excVal.toFixed(2);
        }

        setupLookup(regValForm, 'MapPerPiece', calcRV);
        regValForm.querySelectorAll('input').forEach(i => i.addEventListener('input', calcRV));
        regValForm.addEventListener('submit', (e) => handleGenericSubmit(e, regValForm, 'saveRegisterValidation', 'regValMessage', 'submitRegValBtn', ['Timestamp', 'SubmittedBy', 'StoreCode', 'Date']));
    }

    // --- 9. Tab 5: QC & JioMart Exception ---
    const qcJioForm = document.getElementById('qcJioForm');
    if (qcJioForm) {
        function calcQJ() {
            const map = parseFloat(qcJioForm.querySelector('[name="MapPerPiece"]')?.value) || 0;
            const invQty = parseFloat(qcJioForm.querySelector('[name="InvoiceQty"]')?.value) || 0;
            const packQty = parseFloat(qcJioForm.querySelector('[name="PackQty"]')?.value) || 0;
            const damaged = parseFloat(qcJioForm.querySelector('[name="Damaged"]')?.value) || 0;
            const nearExp = parseFloat(qcJioForm.querySelector('[name="NearExpired"]')?.value) || 0;
            const expired = parseFloat(qcJioForm.querySelector('[name="Expired"]')?.value) || 0;

            // AUTO-CALCULATE Excess / Short from Invoice vs Pack Qty
            const diff = packQty - invQty;
            const excess = diff > 0 ? diff : 0;    // Pack > Invoice = Excess
            const short = diff < 0 ? Math.abs(diff) : 0; // Pack < Invoice = Short

            // Push auto-calculated Excess & Short back into form
            const excessEl = qcJioForm.querySelector('[name="Excess"]');
            const shortEl = qcJioForm.querySelector('[name="Short"]');
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
                const el = qcJioForm.querySelector(`[name="${name}"]`);
                if (el) el.value = val ? val.toFixed(2).replace(/\.00$/, '') : '';
            }
        }

        setupLookup(qcJioForm, 'MapPerPiece', calcQJ);
        // Trigger calc on InvoiceQty, PackQty AND all manual discrepancy inputs
        qcJioForm.querySelectorAll('[name="InvoiceQty"],[name="PackQty"],.qj-calc-trigger')
            .forEach(i => i.addEventListener('input', calcQJ));
        qcJioForm.addEventListener('submit', (e) => handleGenericSubmit(e, qcJioForm, 'saveQcJio', 'qcJioMessage', 'submitQcJioBtn', ['Timestamp', 'SubmittedBy', 'StoreCode', 'Date', 'LpaName', 'OrderNo']));
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
    const unbilledForm = document.getElementById('unbilledForm');
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

        function calcUT() {
            const map = parseFloat(unbilledForm.querySelector('[name="MapPerPiece"]')?.value) || 0;
            const qty = parseFloat(unbilledForm.querySelector('[name="Quantity"]')?.value) || 0;
            const total = qty * map;

            const totalEl = unbilledForm.querySelector('[name="TotalValue"]');
            if (totalEl) totalEl.value = total.toFixed(2).replace(/\.00$/, '');
        }

        setupLookup(unbilledForm, 'MapPerPiece', calcUT);
        unbilledForm.querySelector('[name="Quantity"]')?.addEventListener('input', calcUT);
        unbilledForm.addEventListener('submit', (e) => handleGenericSubmit(e, unbilledForm, 'saveIncident', 'unbilledMessage', 'submitUnbilledBtn', ['Timestamp', 'SubmittedBy', 'StoreCode', 'Date', 'LpaName', 'ExceptionType']));
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
            if (form.querySelector(`[name="${key}"]`)?.hasAttribute('required') && !val && val !== 0) {
                const label = form.querySelector(`[name="${key}"]`)?.previousElementSibling?.textContent || key;
                missing.push(label);
            }
        }
        if (!data.ArticleCode && !data.EnaCode && !data.EanCode && (form.id !== 'dataForm')) {
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
        // Show only the employee name — no 'Welcome,' prefix
        if (welcomeText) welcomeText.textContent = user.name || user.empCode || 'User';
        if (userRole) userRole.textContent = user.role || 'Staff';
        resetFormDates();
        // Initialize camera scanner buttons after login
        initCameraScanner();
    }

    // ============================================
    // CAMERA BARCODE SCANNER
    // ============================================
    function initCameraScanner() {
        document.querySelectorAll('.scan-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const targetName = btn.getAttribute('data-target');
                const form = btn.closest('form');
                if (!form) return;

                // Try BarcodeDetector API (Chrome Android)
                if ('BarcodeDetector' in window) {
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({
                            video: { facingMode: 'environment' }
                        });
                        // Create live scanner overlay
                        const overlay = document.createElement('div');
                        overlay.id = 'scanOverlay';
                        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;';
                        const video = document.createElement('video');
                        video.style.cssText = 'width:100%;max-width:400px;border-radius:12px;';
                        video.srcObject = stream;
                        video.autoplay = true;
                        video.playsInline = true;
                        const hint = document.createElement('p');
                        hint.textContent = '📷 Point at barcode — auto-detecting...';
                        hint.style.cssText = 'color:white;margin-top:20px;font-size:15px;text-align:center;padding:0 20px;';
                        const closeBtn = document.createElement('button');
                        closeBtn.textContent = '✕ Cancel';
                        closeBtn.style.cssText = 'margin-top:16px;padding:12px 28px;background:#ef4444;color:white;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;';
                        overlay.appendChild(video);
                        overlay.appendChild(hint);
                        overlay.appendChild(closeBtn);
                        document.body.appendChild(overlay);

                        const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'qr_code', 'upc_a', 'upc_e'] });
                        let scanning = true;

                        closeBtn.onclick = () => {
                            scanning = false;
                            stream.getTracks().forEach(t => t.stop());
                            overlay.remove();
                        };

                        const scan = async () => {
                            if (!scanning) return;
                            try {
                                const codes = await detector.detect(video);
                                if (codes.length > 0) {
                                    const barcode = codes[0].rawValue;
                                    scanning = false;
                                    stream.getTracks().forEach(t => t.stop());
                                    overlay.remove();
                                    // Fill the target field
                                    const targetEl = form.querySelector(`[name="${targetName}"]`);
                                    if (targetEl) {
                                        targetEl.value = barcode;
                                        targetEl.dispatchEvent(new Event('input'));
                                    }
                                    return;
                                }
                            } catch (e) { }
                            if (scanning) requestAnimationFrame(scan);
                        };
                        video.onloadedmetadata = () => requestAnimationFrame(scan);
                        return;
                    } catch (err) {
                        console.warn('Camera access failed:', err);
                    }
                }

                // Fallback: file input with camera
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*';
                fileInput.capture = 'environment';
                fileInput.onchange = async () => {
                    if (!fileInput.files[0]) return;
                    if ('BarcodeDetector' in window) {
                        const img = await createImageBitmap(fileInput.files[0]);
                        const det = new BarcodeDetector();
                        const codes = await det.detect(img);
                        if (codes.length > 0) {
                            const targetEl = form.querySelector(`[name="${targetName}"]`);
                            if (targetEl) {
                                targetEl.value = codes[0].rawValue;
                                targetEl.dispatchEvent(new Event('input'));
                            }
                        } else {
                            alert('No barcode detected. Please try again.');
                        }
                    } else {
                        alert('Barcode scanning not supported on this device/browser.');
                    }
                };
                fileInput.click();
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
