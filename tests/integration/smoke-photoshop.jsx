// AI Design Agent — Photoshop smoke test (Phase 3 §10, integration N1)
// Creates 1080x1350 doc, background, basic shape, two text layers, saves PSD + exports PNG.
app.displayDialogs = DialogModes.NO;

var W = 1080, H = 1350;
var ROOT = "C:/Users/Power tech/Documents/Default Project/ai-design-agent/workspace";

function rgb(r, g, b) { var c = new RGBColor(); c.red = r; c.green = g; c.blue = b; return c; }

var d = app.documents.add(W, H, 72, "smoke-photoshop", NewDocumentMode.RGB, DocumentFill.WHITE, 1, BitsPerChannelType.EIGHT);

// Background (pixel layer, full canvas)
d.selection.selectAll();
d.selection.fill(rgb(11, 61, 92), ColorBlendMode.NORMAL, 100, false);
d.selection.deselect();

// Basic shape: accent band
d.selection.select([[0, 0], [W, 0], [W, 300], [0, 300]], SelectionType.REPLACE, 0, false);
d.selection.fill(rgb(244, 164, 23), ColorBlendMode.NORMAL, 100, false);
d.selection.deselect();

// White chip behind the secondary text (PS 26: TextItem.color is broken —
// default black text needs a light surface for contrast; see TEST_PLAN N1 notes)
d.selection.select([[180, 850], [900, 850], [900, 985], [180, 985]], SelectionType.REPLACE, 0, false);
d.selection.fill(rgb(255, 255, 255), ColorBlendMode.NORMAL, 100, false);
d.selection.deselect();

// Headline text (default black on orange band = strong contrast)
var hl = d.artLayers.add();
hl.kind = LayerKind.TEXT;
hl.name = "headline";
var t = hl.textItem;
t.contents = "فتح باب التسجيل";
t.size = 96;
t.position = [W / 2, 220];
t.justification = Justification.CENTER;

// Secondary text (black on white chip)
var sl = d.artLayers.add();
sl.kind = LayerKind.TEXT;
sl.name = "secondary";
var t2 = sl.textItem;
t2.contents = "المرحلة العليا — الفصل الأول 2027";
t2.size = 48;
t2.position = [W / 2, 935];
t2.justification = Justification.CENTER;

// Basic shape: accent block (new pixel layer)
var sh = d.artLayers.add();
sh.name = "accent-shape";
d.activeLayer = sh;
d.selection.select([[440, 1060], [640, 1060], [640, 1180], [440, 1180]], SelectionType.REPLACE, 0, false);
d.selection.fill(rgb(244, 164, 23), ColorBlendMode.NORMAL, 100, false);
d.selection.deselect();

// Editable PSD save
var psd = new File(ROOT + "/working/smoke-photoshop.psd");
var psdOpts = new PhotoshopSaveOptions();
psdOpts.layers = true;
psdOpts.embedColorProfile = true;
d.saveAs(psd, psdOpts, true, Extension.LOWERCASE);

// PNG export (flattened duplicate)
var dup = d.duplicate("png-copy", true);
dup.flatten();
var pngOpts = new PNGSaveOptions();
var png = new File(ROOT + "/exports/smoke-photoshop.png");
dup.saveAs(png, pngOpts, true, Extension.LOWERCASE);
dup.close(SaveOptions.DONOTSAVECHANGES);

"OK layers=" + d.layers.length + " size=" + d.width.as("px") + "x" + d.height.as("px");