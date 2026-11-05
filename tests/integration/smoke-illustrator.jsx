// AI Design Agent — Illustrator smoke test (Phase 3 §11, integration N2)
// Artboard 1080x1350, background, basic shape, Arabic text, AI save, PNG export.
var W = 1080, H = 1350;
var ROOT = "C:/Users/Power tech/Documents/Default Project/ai-design-agent/workspace";
function rgb(r, g, b) { var c = new RGBColor(); c.red = r; c.green = g; c.blue = b; return c; }
var navy = rgb(11, 61, 92), orange = rgb(244, 164, 23), white = rgb(255, 255, 255), black = rgb(0, 0, 0);
function tryFont(atts, names) {
  for (var i = 0; i < names.length; i++) {
    try { atts.textFont = app.textFonts.getByName(names[i]); return names[i]; } catch (eNot) {}
  }
  return "(default)";
}

var doc = app.documents.add(DocumentColorSpace.RGB, W, H);

// Background (solid artboard rect)
var bgL = doc.layers.add(); bgL.name = "background";
doc.activeLayer = bgL;
var bg = doc.pathItems.rectangle(H, 0, W, H);
bg.filled = true; bg.fillColor = navy; bg.stroked = false;

// Basic shapes: accent band + accent block + white chip
var sL = doc.layers.add(); sL.name = "shapes";
doc.activeLayer = sL;
var band = doc.pathItems.rectangle(H, 0, W, 300);
band.filled = true; band.fillColor = orange; band.stroked = false;
var block = doc.pathItems.rectangle(290, 440, 200, 120);
block.filled = true; block.fillColor = orange; block.stroked = false;
var chip = doc.pathItems.rectangle(985, 180, 720, 135);
chip.filled = true; chip.fillColor = white; chip.stroked = false;

// Headline text (Arabic)
var hL = doc.layers.add(); hL.name = "headline";
doc.activeLayer = hL;
var t1 = doc.textFrames.add();
t1.name = "headline";
t1.contents = "فتح باب التسجيل";
var a1 = t1.textRange.characterAttributes;
a1.size = 96;
a1.fillColor = navy;
var f1 = tryFont(a1, ["Tahoma Bold", "Tahoma"]);
t1.position = [90, H - 220];

// Secondary text (Arabic, on chip)
var s2 = doc.layers.add(); s2.name = "secondary";
doc.activeLayer = s2;
var t2 = doc.textFrames.add();
t2.name = "secondary";
t2.contents = "المرحلة العليا — الفصل الأول 2027";
var a2 = t2.textRange.characterAttributes;
a2.size = 48;
a2.fillColor = navy;
var f2 = tryFont(a2, ["Tahoma"]);
t2.position = [210, 900];

// Editable AI save
var aiOpts = new IllustratorSaveOptions();
aiOpts.pdfCompatible = true;
doc.saveAs(new File(ROOT + "/working/smoke-illustrator.ai"), aiOpts);

// PNG export (artboard)
var pngOpts = new PNGExportOptions();
pngOpts.transparency = false;
pngOpts.antialias = true;
pngOpts.artBoardClipping = true;
doc.exportFile(new File(ROOT + "/exports/smoke-illustrator.png"), ExportType.PNG24, pngOpts);

"OK layers=" + doc.layers.length + " size=" + doc.width + "x" + doc.height;