function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);
    
    sheet.appendRow([
      data.waktu || new Date().toLocaleString("id-ID"),
      data.warga,
      data.jenis,
      data.berat,
      data.totalRp
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      message: "Data penimbangan berhasil masuk ke Google Sheets!" 
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      message: error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const rows = sheet.getDataRange().getValues();
    
    return ContentService.createTextOutput(JSON.stringify(rows))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      message: error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}