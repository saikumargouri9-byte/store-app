/**
 * REQUIRED STEPS:
 * 1. Go to your Google Sheet.
 * 2. Click Extensions -> Apps Script.
 * 3. Delete any code there, and paste ALL of the code below into it.
 * 4. Save the file (Ctrl+S or Cmd+S).
 * 5. Click "Deploy" -> "Manage Deployments" -> Edit (pencil icon) -> select "New version" -> Deploy.
 *    (Make sure it's accessible by "Anyone").
 */

function doGet(e) {
    return handleRequest(e);
}

function doPost(e) {
    return handleRequest(e);
}

function handleRequest(e) {
    try {
        // If no action provided, just return success testing message
        if (!e.parameter.action) {
            return ContentService.createTextOutput(JSON.stringify({
                status: "success",
                message: "API is working!"
            })).setMimeType(ContentService.MimeType.JSON);
        }

        var action = e.parameter.action;
        var mobile = e.parameter.mobile;

        if (action === 'login') {
            var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Employees");
            if (!sheet) {
                return ContentService.createTextOutput(JSON.stringify({
                    status: "error", message: "Sheet 'Employees' not found. Ensure the tab is exactly named 'Employees'."
                })).setMimeType(ContentService.MimeType.JSON);
            }

            var data = sheet.getDataRange().getValues();
            var found = false;
            var userData = null;

            // Assume row 1 (index 0) has headers: MobileNumber, Name, Role
            // Loop begins at 1 to skip headers
            for (var i = 1; i < data.length; i++) {
                var rowMobile = String(data[i][0]).trim(); // Column A
                if (rowMobile === String(mobile).trim()) {
                    found = true;
                    userData = {
                        mobile: rowMobile,
                        name: data[i][1] || "Employee", // Column B
                        role: data[i][2] || "Staff"    // Column C
                    };
                    break;
                }
            }

            if (found) {
                return ContentService.createTextOutput(JSON.stringify({
                    status: "success",
                    user: userData
                })).setMimeType(ContentService.MimeType.JSON);
            } else {
                return ContentService.createTextOutput(JSON.stringify({
                    status: "error",
                    message: "Mobile number not authorized."
                })).setMimeType(ContentService.MimeType.JSON);
            }
        }

        return ContentService.createTextOutput(JSON.stringify({
            status: "error", message: "Invalid action."
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({
            status: "error", message: err.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}
