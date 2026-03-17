function doGet(e) {
  if (!e || !e.parameter) {
    return ContentService.createTextOutput("System Active.").setMimeType(ContentService.MimeType.TEXT);
  }

  const action = e.parameter.action;
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
      { name: 'ReceivingExceptions', dateCol: 'StockReceivingDate', storeCol: 'SiteCode', lpaCol: 'LpaName', catCol: '', valCol: 'TotalValue' },
      { name: 'FloorWalk', dateCol: 'Date', storeCol: 'Store', lpaCol: 'LpaName', catCol: 'DiscrepancyCategory', valCol: 'TotalValue' },
      { name: 'RegisterValidation', dateCol: 'Date', storeCol: 'StoreCode', lpaCol: 'CheckingLpaName', catCol: 'RegisterName', valCol: 'ExceptionValue' },
      { name: 'QcJioExceptions', dateCol: 'Date', storeCol: 'StoreCode', lpaCol: 'LpaName', catCol: '', valCol: 'TotalValue' },
      { name: 'FashionExceptions', dateCol: 'Date', storeCol: 'StoreCode', lpaCol: 'LpaName', catCol: '', valCol: 'TotalValue' },
      { name: 'IncidentLogs', dateCol: 'Date', storeCol: 'StoreCode', lpaCol: 'LpaName', catCol: 'ExceptionType', valCol: 'TotalValue' }
    ];

    let totalExceptions = 0;
    const dateWise = {};
    const moduleWise = {};
    const adminData = [];

    tabs.forEach(tab => {
      const sheet = ss.getSheetByName(tab.name);
      if (sheet) {
        const lastRow = sheet.getLastRow();
        const lastCol = sheet.getLastColumn();
        if (lastRow > 1) {
          const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
          const headers = values[0].map(h => String(h).replace(/\s+/g, '').toLowerCase());
          
          let dateIndex = -1, userIndex = -1, storeIdx = -1, lpaIdx = -1, catIdx = -1, valIdx = -1;
          const targetDateKey = tab.dateCol.toLowerCase();
          
          headers.forEach((h, i) => {
            if (h === targetDateKey || (dateIndex === -1 && h.includes('date'))) dateIndex = i;
            if (h === 'submittedby') userIndex = i;
            if (h === tab.storeCol.toLowerCase() || (storeIdx === -1 && (h.includes('store') || h.includes('sitecode')))) storeIdx = i;
            if (tab.lpaCol && h === tab.lpaCol.toLowerCase()) lpaIdx = i;
            if (tab.catCol && h === tab.catCol.toLowerCase()) catIdx = i;
            if (h === tab.valCol.toLowerCase() || (valIdx === -1 && h.includes('value'))) valIdx = i;
          });

          for (let i = 1; i < values.length; i++) {
            const rowUser = String(values[i][userIndex] || '').trim().toLowerCase();
            
            if (!isAdmin && filterEmpCode && userIndex !== -1) {
                if (rowUser !== filterEmpCode) continue;
            }

            let dateVal = 'Unknown Date';
            if (dateIndex !== -1 && values[i][dateIndex]) {
               try {
                 const d = new Date(values[i][dateIndex]);
                 if (!isNaN(d.getTime())) {
                   const yyyy = d.getFullYear();
                   const mm = String(d.getMonth() + 1).padStart(2, '0');
                   const dd = String(d.getDate()).padStart(2, '0');
                   dateVal = `${yyyy}-${mm}-${dd}`;
                 } else {
                   dateVal = String(values[i][dateIndex]).trim();
                 }
               } catch(e) {
                 dateVal = String(values[i][dateIndex]).trim();
               }
            }

            if (isAdmin) {
               let catVal = tab.name;
               if (catIdx !== -1 && values[i][catIdx]) catVal = String(values[i][catIdx]);

               adminData.push({
                   date: dateVal,
                   store: storeIdx !== -1 ? String(values[i][storeIdx]) : 'Unknown',
                   lpa: lpaIdx !== -1 ? String(values[i][lpaIdx]) : 'Unknown',
                   category: catVal,
                   value: valIdx !== -1 ? parseFloat(values[i][valIdx]) || 0 : 0,
                   empCode: userIndex !== -1 ? String(values[i][userIndex]) : 'Unknown',
                   module: tab.name
               });
            } else {
               totalExceptions++;
               if (!dateWise[dateVal]) dateWise[dateVal] = 0;
               dateWise[dateVal]++;
               
               if (!moduleWise[tab.name]) moduleWise[tab.name] = 0;
               moduleWise[tab.name]++;
            }
          }
        }
      }
    });

    if (isAdmin) {
       return createResponse({ status: 'success', data: { adminData: adminData } });
    }

    // Sort dates
    const sortedDates = Object.keys(dateWise).sort((a,b) => b.localeCompare(a)).reduce((obj, key) => { 
      obj[key] = dateWise[key]; 
      return obj;
    }, {});

    // Sort modules by count
    const sortedModules = Object.keys(moduleWise).sort((a,b) => moduleWise[b] - moduleWise[a]).reduce((obj, key) => {
      obj[key] = moduleWise[key];
      return obj;
    }, {});

    return createResponse({ status: 'success', data: { total: totalExceptions, dateWise: sortedDates, moduleWise: sortedModules } });
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
    const noOfItems = parseInt(e.parameter['NoOfItems'] || "1");
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

            // Auto-fallback for Floor Walk "Category" variations
            if (keyLower === 'category' || keyLower === 'discrepancy' || keyLower === 'discrepancycategory') {
                return getVal('DiscrepancyCategory') || getVal(key) || getVal(h);
            }

            // Auto-fallback for "Quantity" variations
            if (keyLower === 'qty' || keyLower === 'quantity' || keyLower === 'quantities') {
                return getVal('Quantity') || getVal(key) || getVal(h);
            }

            // Auto-fallback for "Involved EMP" / Employee / Incident variations
            if (keyLower.includes('empname') || keyLower.includes('empid') || keyLower.includes('employeename') || keyLower.includes('employeecode')) {
                if (keyLower.includes('name')) return getVal('EmpName') || getVal('InvolvedEmpName') || getVal(key) || getVal(h);
                if (keyLower.includes('id') || keyLower.includes('code')) return getVal('EmpID') || getVal('InvolvedEmpCode') || getVal(key) || getVal(h);
            }

            return getVal(key) || getVal(h);
        });

        sheet.appendRow(rowData);
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
    'ReceivingExceptions': ['Timestamp','SubmittedBy','LpaName','StockReceivingDate','SendingDCCode','SiteCode','TripNo','TripDate','VehicleNo','STNNo','DeliveryNo','HUNo','ArticleCode','EnaCode','ArticleDescription','MapPerPiece','HuQty','ReceivedQty','Excess','ExcessVal','Short','ShortVal','Damaged','DamageVal','NearExpired','NearExpiryVal','Expired','NoOfException','NoOfDiscrepantEaches','TotalValue','Remarks'],
    'FloorWalk':           ['Timestamp','SubmittedBy','Store','Date','LpaName','Location','ArticleCode','EanCode','ArticleDescription','EaValueMap','DiscrepancyCategory','Quantity','CalculatedValue','TotalQty','TotalValue'],
    'RegisterValidation':  ['Timestamp','SubmittedBy','StoreCode','Date','BusinessType','RegisterName','CheckingLpaName','NoOfException','ArticleCode','EanCode','ArticleDescription','MapPerPiece','RegisterQty','DocumentQuantity','ExceptionQty','ExceptionValue','OthersRemarks'],
    'QcJioExceptions':     ['Timestamp','SubmittedBy','StoreCode','Date','LpaName','OrderNo','PickerID','PickerName','ArticleCode','EanCode','ArticleDescription','InvoiceQty','PackQty','Excess','ExcessVal','Short','ShortVal','Damaged','DamageVal','NearExpired','NearExpiryVal','Expired','ExpireVal','TotalDiscrepantEaches','MapPerPiece','TotalValue','Remarks'],
    'FashionExceptions':   ['Timestamp','SubmittedBy','StoreCode','Date','LpaName','Location','ArticleCode','EanCode','ArticleDescription','NoHardtagQty','NoHardtagVal','DamagedQty','DamageVal','GrazingQty','GrazingVal','MapPerPiece','TotalValue','Remarks'],
    'IncidentLogs':        ['Timestamp','SubmittedBy','StoreCode','Date','LpaName','ExceptionType','NoOfException','EmpName','EmpID','BilledNo','RposID','CustomerName','CustomerGender','LocationFound','EanCode','ArticleCode','ArticleDescription','Quantity','MapPerPiece','TotalValue'],
    'SegmentCount':        ['Timestamp','SubmittedBy','SiteCode','Date','LpaName','Segment','Category','OverallSystemQty','OverallPhysicalQty','OverallDifferenceQty','OverallShrinkValue','NoOfItems','ArticleCode','EanCode','ArticleDescription','SystemCount','PhysicalCount','Variance','VarianceValue'],
    'ShortPick':           ['Timestamp','SubmittedBy','StoreCode','Date','LpaName','OverallShortOrders','OverallShortQty','OverallShortValue','NoOfItems','ArticleCode','EanCode','ArticleDescription','SystemCount','PhysicalCount','Variance','ShortValue','Reason']
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
  const sheetNames = ['VehicleData','ReceivingExceptions','FloorWalk','RegisterValidation','QcJioExceptions','FashionExceptions','IncidentLogs','Employees','JS Master','SegmentCount','ShortPick'];
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
