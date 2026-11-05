// Probe: PNG export paths in Illustrator 29
var ROOT = "C:/Users/Power tech/Documents/Default Project/ai-design-agent/workspace";
var doc = app.activeDocument;
var out = "";
out += "typeof ExportType.PNG24=" + (typeof ExportType.PNG24) + "; ";
out += "typeof PNGExportOptions=" + (typeof PNGExportOptions) + "; ";
try {
  doc.exportFile(new File(ROOT + "/exports/smoke-illustrator.png"), ExportType.PNG24);
  out += "noOpts OK";
} catch (e1) {
  out += "noOpts FAIL: " + e1.message + "; ";
  try {
    var o = new ExportOptions();
    o.exportFormat = ExportFormat.PNG24;
    doc.exportFile(new File(ROOT + "/exports/smoke-illustrator.png"), ExportType.PNG24);
    out += "ExportOptions OK";
  } catch (e2) { out += "ExportOptions FAIL: " + e2.message; }
}
out;