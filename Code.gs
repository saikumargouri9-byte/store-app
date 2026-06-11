function doGet(e) {
  // Serve the PWA frontend if no API action is requested
  const action = e && e.parameter ? e.parameter.action : null;
  if (!action) {
    return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('Store Pro - Reliance Retail')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.SandboxMode.IFRAME);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (action === 'login') {
    const sheet = ss.getSheetByName('Employees');
    if (!sheet) return createResponse({ status: 'error', message: 'Employees sheet missing. Run initialSetup from editor.' });
    const data = sheet.getDataRange().getValues();
    const empCode = String(e.parameter.empCode || '').trim();
    const password = String(e.parameter.password || '').trim();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === empCode && String(data[i][1]).trim() === password) {
        return createResponse({ status: 'success', user: { empCode: data[i][0], name: data[i][2], role: data[i][3] } });
      }
    }
    return createResponse({ status: 'error', message: 'Invalid credentials' });
  }

  if (action === 'getEmployeeData') {
    const empSheet = ss.getSheetByName('Employee data');
    if (!empSheet) return createResponse({ status: 'error', message: 'Employee data sheet not found' });
    const data = empSheet.getDataRange().getValues();
    const empId = String(e.parameter.empId || '').trim();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === empId) {
        return createResponse({ status: 'success', name: data[i][1] });
      }
    }
    return createResponse({ status: 'error', message: 'Employee not found' });
  }

  if (action === 'getMasterData') {
    const masterSheet = ss.getSheetByName('JS Master');
    if (!masterSheet) return createResponse({ status: 'error', message: 'JS Master sheet not found' });
    const data = masterSheet.getDataRange().getValues();
    const result = {};
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const item = { code: row[0], ena: row[1], desc: row[2], map: row[3] };
      if (row[0]) result[String(row[0]).trim()] = item;
      if (row[1]) result[String(row[1]).trim()] = item;
    }
    return createResponse({ status: 'success', data: result });
  }

  if (action === 'getDashboardData') {
    const filterEmpCode = String(e.parameter.empCode || '').trim().toLowerCase();
    const isAdmin = e.parameter.isAdmin === 'true';

    const tabs = [
      { name: 'VehicleData', dateCol: 'Date', storeCol: 'SiteCode', lpaCol: 'LPA', catCol: 'ReceivedType', valCol: 'InvoiceValue' },
      { name: 'ReceivingExceptions', dateCol: 'StockReceivingDate', storeCol: 'SiteCode', lpaCol: 'LpaName', catCol: '', valCol: 'TotalValue' },
      { name: 'FloorWalk', dateCol: 'Date', storeCol: 'Store', lpaCol: 'LpaName', catCol: 'DiscrepancyCategory', valCol: 'TotalValue' },
      { name: 'RegisterValidation', dateCol: 'Date', storeCol: 'StoreCode', lpaCol: 'CheckingLpaName', catCol: 'RegisterName', valCol: 'ExceptionValue' },
      { name: 'QcJioExceptions', dateCol: 'Date', storeCol: 'StoreCode', lpaCol: 'LpaName', catCol: '', valCol: 'TotalValue' },
      { name: 'FashionExceptions', dateCol: 'Date', storeCol: 'StoreCode', lpaCol: 'LpaName', catCol: '', valCol: 'TotalValue' },
      { name: 'IncidentLogs', dateCol: 'Date', storeCol: 'StoreCode', lpaCol: 'LpaName', catCol: 'ExceptionType', valCol: 'TotalValue' },
      { name: 'SegmentCount', dateCol: 'Date', storeCol: 'SiteCode', lpaCol: 'LpaName', catCol: 'Segment', valCol: 'OverallShrinkValue' },
      { name: 'ShortPick', dateCol: 'Date', storeCol: 'StoreCode', lpaCol: 'LpaName', catCol: 'Reason', valCol: 'ShortValue' },
      { name: 'VehInwards', dateCol: 'Date', storeCol: 'SiteCode', lpaCol: 'LPA', catCol: 'ReceivedType', valCol: 'InvoiceValue' }
    ];

    let totalExceptions = 0;
    const dateWise = {};
    const moduleWise = {};
    const adminData = [];
    const vehicleStats = { totalCount: 0, totalValue: 0, types: { 'CPC': 0, 'DC': 0, 'DSD': 0, 'IST': 0, 'Other': 0 } };


    tabs.forEach(tab => {
      const sheet = ss.getSheetByName(tab.name);
      if (sheet) {
        const lastRow = sheet.getLastRow();
        const lastCol = sheet.getLastColumn();
        if (lastRow > 1) {
          const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
          const rawHeaders = values[0].map(h => String(h).trim());
          const cleanHeaders = rawHeaders.map(h => h.replace(/\s+/g, '').toLowerCase());
          
          const findIdx = (target) => {
            if (!target) return -1;
            const tClean = target.replace(/\s+/g, '').toLowerCase();
            let idx = cleanHeaders.indexOf(tClean);
            if (idx !== -1) return idx;
            // Robust check: if exact match fails, try containment
            return cleanHeaders.findIndex(h => h.includes(tClean) || tClean.includes(h)); 
          };

          let dateIndex = findIdx(tab.dateCol);
          let userIndex = findIdx('submittedby');
          let storeIdx = findIdx(tab.storeCol);
          let lpaIdx = findIdx(tab.lpaCol);
          let catIdx = findIdx(tab.catCol);
          let valIdx = findIdx(tab.valCol);

          // Fallbacks for date and store
          if (dateIndex === -1) dateIndex = cleanHeaders.findIndex(h => h.includes('date'));
          if (storeIdx === -1) storeIdx = cleanHeaders.findIndex(h => h.includes('store') || h.includes('sitecode'));
          if (valIdx === -1) valIdx = cleanHeaders.findIndex(h => (h.includes('value') || h.includes('val')) && !h.includes('map'));

          for (let i = 1; i < values.length; i++) {
            const rowUser = userIndex !== -1 ? String(values[i][userIndex] || '').trim().toLowerCase() : '';
            
            if (!isAdmin && filterEmpCode) {
                if (rowUser !== filterEmpCode) continue;
            }

            let dateVal = 'Unknown Date';
            if (dateIndex !== -1 && values[i][dateIndex]) {
               try {
                 const rawDate = values[i][dateIndex];
                 const d = (rawDate instanceof Date) ? rawDate : new Date(rawDate);
                 if (!isNaN(d.getTime())) {
                   const yyyy = d.getFullYear();
                   const mm = String(d.getMonth() + 1).padStart(2, '0');
                   const dd = String(d.getDate()).padStart(2, '0');
                   dateVal = `${yyyy}-${mm}-${dd}`;
                 } else {
                   dateVal = String(rawDate).trim();
                 }
               } catch(e) {
                 dateVal = String(values[i][dateIndex]).trim();
               }
            }

            // Numeric value parsing with robust cleanup
            const rawVal = values[i][valIdx];
            let numVal = 0;
            if (typeof rawVal === 'number') {
              numVal = rawVal;
            } else if (rawVal) {
              // Removes currency symbols, commas, and hidden spaces
              const cleaned = String(rawVal).replace(/[₹\s,]/g, '').trim();
              numVal = parseFloat(cleaned) || 0;
            }

            // COMPATIBILITY BRIDGE: Sending both long and short labels
            const record = {
                date: String(dateVal || '').trim() || 'Unknown Date',
                store: (storeIdx !== -1 && values[i][storeIdx]) ? String(values[i][storeIdx]).trim() : 'Unknown',
                lpa: (lpaIdx !== -1 && values[i][lpaIdx]) ? String(values[i][lpaIdx]).trim() : 'Unknown',
                
                // FIXED: Use tab name as category if column is empty
                category: (catIdx !== -1 && values[i][catIdx]) ? String(values[i][catIdx]).trim() : tab.name,
                
                // Long labels (Standard)
                value: numVal,
                empCode: (userIndex !== -1 && values[i][userIndex]) ? String(values[i][userIndex]).trim() : 'Unknown',
                module: tab.name || 'Unknown',
                
                // Short labels (Compatibility for older app versions)
                val: numVal,
                user: (userIndex !== -1 && values[i][userIndex]) ? String(values[i][userIndex]).trim() : 'Unknown',
                mod: tab.name,
                cat: (catIdx !== -1 && values[i][catIdx]) ? String(values[i][catIdx]).trim() : tab.name
            };

            adminData.push(record);

            if (!isAdmin) {
                totalExceptions++;
                if (!dateWise[dateVal]) dateWise[dateVal] = 0;
                dateWise[dateVal]++;
                
                if (!moduleWise[tab.name]) moduleWise[tab.name] = 0;
                moduleWise[tab.name]++;
            }


            // Update Vehicle Stats if this is the vehicle sheet
            if (tab.name === 'VehicleData') {
                vehicleStats.totalCount++;
                vehicleStats.totalValue += numVal;
                let typeVal = 'Other';
                if (catIdx !== -1 && values[i][catIdx]) {
                    const t = String(values[i][catIdx]).trim();
                    if (t in vehicleStats.types) typeVal = t;
                }
                vehicleStats.types[typeVal]++;
            }


          }
        }
      }
    });




    // Return adminData for both Admin and Staff (Staff view is filtered above)
    return createResponse({ status: 'success', data: { 
      total: totalExceptions, 
      adminData: adminData,
      vehicleStats: vehicleStats 
    } });

  }

  const saveActions = {
    'saveData':               'VehicleData',
    'saveRecvException':      'ReceivingExceptions',
    'saveFloorWalk':          'FloorWalk',
    'saveRegisterValidation': 'RegisterValidation',
    'saveQcJio':              'QcJioExceptions',
    'saveFashion':            'FashionExceptions',
    'saveIncident':           'IncidentLogs',
    'saveSegmentCount':       'SegmentCount',
    'saveShortPick':          'ShortPick'
  };

  if (saveActions[action]) {
    const sheetName = saveActions[action];
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      createSheetWithHeaders(ss, sheetName);
      sheet = ss.getSheetByName(sheetName);
    }
    if (!sheet) return createResponse({ status: 'error', message: 'Sheet "' + sheetName + '" could not be created.' });

    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) return createResponse({ status: 'error', message: 'Sheet "' + sheetName + '" has no headers. Run initialSetup from editor.' });

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const noOfItems = parseInt(e.parameter['NoOfItems'] || e.parameter['NoOfException'] || "1");
    const allParams = e.parameters;

    for (let i = 0; i < noOfItems; i++) {
        const rowData = headers.map(h => {
            const key = String(h).replace(/\s+/g, '');
            const keyLower = key.toLowerCase();
            
            // Get value from arrays (for repeated items) or single parameter (for header fields)
            const getVal = (paramKey) => {
                const arr = allParams[paramKey];
                if (arr && arr.length > i) return arr[i];
                return e.parameter[paramKey] || '';
            };

            // Auto-fallback for Sending Site
            if (key === 'SendingSiteCode' || key === 'SendingSite') {
                return getVal('SendingSite') || getVal('SendingSiteCode') || getVal(h);
            }

            // Fallbacks for Short Pick fields (if sheet still has old headers)
            if (key === 'OrderedQty') return getVal('SystemCount') || getVal(key);
            if (key === 'PickedQty') return getVal('PhysicalCount') || getVal(key);
            if (key === 'ShortQty') return getVal('Variance') || getVal(key);

            // Auto-fallback for Floor Walk "Category" variations
            if (keyLower === 'category' || keyLower === 'discrepancy' || keyLower === 'discrepancycategory') {
                return getVal('DiscrepancyCategory') || getVal(key) || getVal(h);
            }

            if (keyLower === 'employeeid' || keyLower === 'empid') return getVal('EmpID') || getVal(key) || getVal(h);
            if (keyLower === 'employeename' || keyLower === 'empname') return getVal('EmpName') || getVal(key) || getVal(h);

            // Auto-fallback for "Quantity" variations
            if (keyLower === 'qty' || keyLower === 'quantity' || keyLower === 'quantities') {
                return getVal('Quantity') || getVal(key) || getVal(h);
            }

            // Auto-fallback for "Involved EMP" / Employee / Incident variations
            if (['modid', 'pickerid', 'managerid', 'involvedpersonid', 'responsibilitypersonemployeeid', 'employeeid', 'empid', 'involvedempcode'].includes(keyLower)) {
                return getVal('EmpID') || getVal(key) || getVal(h);
            }
            if (['modname', 'pickername', 'managername', 'involvedpersonname', 'responsibilitypersonemployeename', 'employeename', 'empname', 'involvedempname'].includes(keyLower)) {
                return getVal('EmpName') || getVal(key) || getVal(h);
            }

            if (keyLower === 'totalvalueoforder') {
                return getVal('Total Value of Order') || getVal('TotalValueOfOrder') || getVal(key) || getVal(h);
            }

            if (keyLower === 'totalvalue') {
                return getVal('TotalValue') || getVal(key) || getVal(h);
            }

            if (keyLower === 'mapperpiece') {
                return getVal('MapPerPiece') || getVal(key) || getVal(h);
            }

            return getVal(key) || getVal(h);
        });

        sheet.appendRow(rowData);
    }
    
    
    // NEW LOGIC TO SAVE TO EMPLOYEE DATA SHEET
    const empId = String(e.parameter.EmpID || '').trim();
    const empName = String(e.parameter.EmpName || '').trim();
    if (empId && empName) {
        let empSheet = ss.getSheetByName('Employee data');
        if (!empSheet) {
            createSheetWithHeaders(ss, 'Employee data');
            empSheet = ss.getSheetByName('Employee data');
        }
        if (empSheet) {
            const data = empSheet.getDataRange().getValues();
            let found = false;
            let rowIndex = -1;
            for (let i = 1; i < data.length; i++) {
                if (String(data[i][0]).trim() === empId) {
                    found = true;
                    rowIndex = i + 1;
                    break;
                }
            }
            if (!found) {
                empSheet.appendRow([empId, empName]);
            } else if (rowIndex > 1 && data[rowIndex-1]) {
                if (String(data[rowIndex-1][1]).trim() !== empName) {
                    empSheet.getRange(rowIndex, 2).setValue(empName);
                }
            }
        }
    }

    return createResponse({ status: 'success', message: 'Saved ' + noOfItems + ' records to ' + sheetName });
  }

  return createResponse({ status: 'error', message: 'Action "' + action + '" not recognized.' });
}

// Called safely from doGet (no UI)
function createSheetWithHeaders(ss, sheetName) {
  const headersMap = {
    //  ↓ FIXED: 'SendingSiteCode' renamed to 'Sending Site' to match frontend field (SendingSite after space-strip)
    'VehicleData':         ['Timestamp','SubmittedBy','LPA','InwardNumber','Date','ReceivedType','SiteCode','SiteName','VehicleNo','TripNo','Sending Site','InvoiceNumber','InvoiceValue','StnQty','HuQty','HuReceived','HuDamaged','HuShort','MicroCheck','GrnStatus','ShortValue','DamagedValue','NearExpiredValue','ExpiredValue'],
    'ReceivingExceptions': ['Timestamp','SubmittedBy','LpaName','StockReceivingDate','SendingDCCode','SiteCode','TripNo','TripDate','VehicleNo','STNNo','DeliveryNo','HUNo','MOD ID','MOD Name','ArticleCode','EnaCode','ArticleDescription','MapPerPiece','HuQty','ReceivedQty','Excess','ExcessVal','Short','ShortVal','Damaged','DamageVal','NearExpired','NearExpiryVal','Expired','NoOfException','NoOfDiscrepantEaches','TotalValue','Remarks'],
    'FloorWalk':           ['Timestamp','SubmittedBy','Store','Date','LpaName','Location','Responsibility Person Employee ID','Responsibility Person Employee Name','ArticleCode','EanCode','ArticleDescription','EaValueMap','DiscrepancyCategory','Quantity','CalculatedValue','TotalQty','TotalValue'],
    'RegisterValidation':  ['Timestamp','SubmittedBy','StoreCode','Date','BusinessType','RegisterName','CheckingLpaName','Involved Person ID','Involved Person Name','NoOfException','ArticleCode','EanCode','ArticleDescription','MapPerPiece','RegisterQty','DocumentQuantity','ExceptionQty','ExceptionValue','OthersRemarks'],
    'QcJioExceptions':     ['Timestamp','SubmittedBy','StoreCode','Date','LpaName','OrderNo','Picker ID','Picker Name','Total Value of Order','ArticleCode','EanCode','ArticleDescription','InvoiceQty','PackQty','Excess','ExcessVal','Short','ShortVal','Damaged','DamageVal','NearExpired','NearExpiryVal','Expired','ExpireVal','TotalDiscrepantEaches','MapPerPiece','TotalValue','Remarks'],
    'FashionExceptions':   ['Timestamp','SubmittedBy','StoreCode','Date','LpaName','Location','Responsibility Person Employee ID','Responsibility Person Employee Name','ArticleCode','EanCode','ArticleDescription','NoHardtagQty','NoHardtagVal','DamagedQty','DamageVal','GrazingQty','GrazingVal','MapPerPiece','TotalValue','Remarks'],
    'IncidentLogs':        ['Timestamp','SubmittedBy','StoreCode','Date','LpaName','ExceptionType','NoOfException','Employee Name','Employee ID','BilledNo','RposID','CustomerName','CustomerGender','LocationFound','EanCode','ArticleCode','ArticleDescription','Quantity','MapPerPiece','TotalValue'],
    'SegmentCount':        ['Timestamp','SubmittedBy','SiteCode','Date','LpaName','Segment','Category','Manager ID','Manager Name','OverallSystemQty','OverallPhysicalQty','OverallDifferenceQty','OverallShrinkValue','NoOfItems','ArticleCode','EanCode','ArticleDescription','SystemCount','PhysicalCount','Variance','VarianceValue'],
    'ShortPick':           ['Timestamp','SubmittedBy','StoreCode','Date','LpaName','OverallShortOrders','OverallShortQty','OverallShortValue','Employee ID','Employee Name','NoOfItems','ArticleCode','EanCode','ArticleDescription','SystemCount','PhysicalCount','Variance','ShortValue','Reason'],
    'Employee data':       ['Employee ID', 'Employee Name']
  };

  const headers = headersMap[sheetName];
  if (!headers) return;
  const sheet = ss.insertSheet(sheetName);
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#4a86e8').setFontColor('#ffffff');
}

// Run this ONCE from the editor to build all sheets
function initialSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetNames = ['VehicleData','ReceivingExceptions','FloorWalk','RegisterValidation','QcJioExceptions','FashionExceptions','IncidentLogs','Employees','JS Master','SegmentCount','ShortPick', 'Employee data'];
  sheetNames.forEach(name => {
    if (!ss.getSheetByName(name)) createSheetWithHeaders(ss, name);
  });
  SpreadsheetApp.getUi().alert('✅ All sheets created successfully!');
}

// ─── NEW UTILITY ───────────────────────────────────────────────────────────────
// Run this ONCE from the editor to add or rename the 'Sending Site' column
function fixSendingSiteHeader() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('VehicleData');
  if (!sheet) {
    SpreadsheetApp.getUi().alert('❌ VehicleData sheet not found.');
    return;
  }
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  let fixed = false;
  let hasSendingSite = false;

  headers.forEach((h, i) => {
    const key = String(h).replace(/\s+/g, '');
    if (key === 'SendingSite') hasSendingSite = true;
    if (key === 'SendingSiteCode') {
      sheet.getRange(1, i + 1).setValue('Sending Site');
      fixed = true;
      hasSendingSite = true;
    }
  });

  if (!hasSendingSite) {
    // If the column doesn't exist at all, add it after TripNo (column J/10)
    sheet.insertColumnAfter(10);
    sheet.getRange(1, 11).setValue('Sending Site');
    sheet.getRange(1, 11).setFontWeight('bold').setBackground('#4a86e8').setFontColor('#ffffff');
    SpreadsheetApp.getUi().alert('✅ NEW Column Added: "Sending Site" (Next to Trip No)');
  } else if (fixed) {
    SpreadsheetApp.getUi().alert('✅ Column Renamed: SendingSiteCode → Sending Site');
  } else {
    SpreadsheetApp.getUi().alert('ℹ️ "Sending Site" column already exists and looks correct!');
  }
}

function createResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
