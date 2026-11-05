app.displayDialogs = DialogModes.NO;
var d = app.documents.add(400, 200, 72, "probe2", NewDocumentMode.RGB, DocumentFill.WHITE);
function rgb(r, g, b) { var c = new RGBColor(); c.red = r; c.green = g; c.blue = b; return c; }
var sc = new SolidColor();
sc.rgb = rgb(0, 128, 1);
app.foregroundColor = sc;
d.selection.selectAll();
d.selection.fill(rgb(255, 0, 0), ColorBlendMode.NORMAL, 100, false);
d.selection.deselect();
var tl = d.artLayers.add();
tl.kind = LayerKind.TEXT;
var t = tl.textItem;
t.contents = "T T T T";
t.size = 120;
t.position = [40, 150];
var png = new File("C:/Users/Power tech/AppData/Local/Temp/opencode/probe-fg.png");
d.saveAs(png, new PNGSaveOptions(), true, Extension.LOWERCASE);
d.close(SaveOptions.DONOTSAVECHANGES);
"saved fg=" + app.foregroundColor.rgb.red + "," + app.foregroundColor.rgb.green + "," + app.foregroundColor.rgb.blue;