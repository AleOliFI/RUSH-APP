// =============================================================
// GOOGLE APPS SCRIPT — Cole este código no Google Apps Script
// =============================================================
//
// PASSO A PASSO:
// 1. Abra o Google Sheets e crie uma planilha nova
// 2. Renomeie a primeira aba para "Leads"
// 3. Na linha 1, crie os cabeçalhos: Email | Origem | Data | Página
// 4. Vá em Extensões → Apps Script
// 5. Apague tudo e cole este código abaixo
// 6. Clique em "Implantar" → "Nova Implantação"
// 7. Tipo: "App da Web"
// 8. Executar como: "Eu"
// 9. Quem tem acesso: "Qualquer pessoa"
// 10. Clique em "Implantar" e copie a URL gerada
// 11. Cole essa URL no .env.local do seu site como GOOGLE_SHEET_WEBHOOK
//
// =============================================================

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Leads");

    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    }

    var data = JSON.parse(e.postData.contents);

    // Adiciona uma nova linha com os dados
    sheet.appendRow([
      data.email || "",
      data.source || "desconhecido",
      data.data || new Date().toLocaleString("pt-BR"),
      data.pagina || "direto"
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Também aceita GET para testar se está funcionando
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: "ok",
      message: "Webhook do RUSH Performance está funcionando!"
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
