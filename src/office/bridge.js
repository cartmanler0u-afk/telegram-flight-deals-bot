// Pont entre le bot de bons plans (vols) et le QG : chaque bon plan posté par le bot
// est aussi transmis aux dénicheurs du QG.

let sink = null;

export function setDealSink(fn) {
  sink = fn;
}

export function shareDeals(deals) {
  if (!sink || !deals?.length) return;
  try {
    sink(deals);
  } catch (err) {
    console.error("QG : transmission des bons plans impossible :", err.message);
  }
}
