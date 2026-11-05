app.displayDialogs = DialogModes.NO;
var W = 400, H = 200;
var d = app.documents.add(W, H, 72, "probe", NewDocumentMode.RGB, DocumentFill.WHITE);
var out = "";
function rgb(r, g, b) { var c = new RGBColor(); c.red = r; c.green = g; c.blue = b; return c; }
var hl = d.artLayers.add();
hl.kind = LayerKind.TEXT;
d.activeLayer = hl;
var t = hl.textItem;
t.contents = "test";
t.size = 60;
out += "contents:size ok; ";
try { t.position = [50, 100]; out += "position ok; "; } catch (e) { out += "position FAIL " + e + "; "; }
try { t.color = rgb(17, 45, 43); out += "color ok; "; } catch (e) { out += "color FAIL " + e + "; "; }
try { t.color = undefined; } catch (e) {}
try { var fresh = new RGBColor(); fresh.red = 11; fresh.green = 61; fresh.blue = 92; hl.textItem.color = fresh; out += "color2 ok; "; } catch (e) { out += "color2 FAIL " + e + "; "; }
try { t.justification = Justification.CENTER; out += "justify ok; "; } catch (e) { out += "justify FAIL " + e + "; "; }
d.close(SaveOptions.DONOTSAVECHANGES);
out;