// Step 10 — Harvest Point. Shows the KB harvest profile for the selected crop; a preview until ready.
import { useMemo } from "react";
import { Eye, Hand, Wheat } from "lucide-react";
import { useTerraform } from "../../store/terraformStore";
import { farmFor, useGame } from "../gameStore";
import { collectPlanItems, worldView } from "../planData";
import RecCard from "./RecCard";
import { Bullets, Card, Chips, DetailsButton, GlassPanel, Pill, PrimaryButton, Section } from "./kit";

export default function HarvestPanel({ onClose }: { onClose: () => void }) {
  const plan = useTerraform((s) => s.plan);
  const analysis = useTerraform((s) => s.analysis);
  const completed = useTerraform((s) => s.completedTasks);
  const crop = useTerraform((s) => s.selectedCropId);
  const reduceMotion = useTerraform((s) => s.reduceMotion);
  const addJournal = useTerraform((s) => s.addJournal);
  const setCurrentStep = useTerraform((s) => s.setCurrentStep);
  const sessionId = useTerraform((s) => s.sessionId);
  const farm = farmFor(useGame((s) => s.farm), sessionId);
  const updateFarm = useGame((s) => s.updateFarm);
  const runAction = useGame((s) => s.runAction);
  const items = useMemo(() => collectPlanItems(plan).filter((i) => i.group === "harvest"), [plan]);

  if (!plan) {
    return (
      <GlassPanel title="Harvest Point" kicker="NOTHING TO HARVEST YET" steps={["harvest"]} onClose={onClose}>
        <Card>
          <p className="text-[13px] text-ivory/80">Harvest guidance appears once you have a plan and a chosen crop.</p>
        </Card>
      </GlassPanel>
    );
  }
  const h = plan.workflow.harvest;
  const view = worldView(analysis, plan, completed, crop, farm);
  const ready = view.stage === "harvest_ready";

  const doHarvest = () =>
    runAction({ kind: "harvest", label: view.cropName ? `Harvesting ${view.cropName}` : "Harvesting", station: "harvest", fast: reduceMotion }, async () => {
      updateFarm(sessionId, { harvested: true });
      setCurrentStep("harvest");
      await addJournal(`Explorer: harvested ${view.cropName ?? "the crop"} at the Harvest Point.`);
      onClose();
      useTerraform.getState().markHarvested(); // → "Season complete" ending
    });

  return (
    <GlassPanel
      title="Harvest Point"
      kicker={ready ? "READY TO HARVEST" : "PREVIEW · CROP NOT READY"}
      steps={["harvest"]}
      onClose={onClose}
      wide
      footer={
        <div className="flex items-center justify-between gap-2">
          <DetailsButton step="harvest" />
          <PrimaryButton tone="amber" disabled={!ready || farm.harvested} onClick={doHarvest}>
            <Wheat className="h-4 w-4" /> {farm.harvested ? "Harvested" : "Harvest"}
          </PrimaryButton>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill tone={ready ? "amber" : "muted"}>{ready ? "harvest-ready" : `plot: ${view.stage.replace(/_/g, " ")}`}</Pill>
        <Pill tone={crop ? "sprout" : "muted"}>crop: {view.cropName ?? "not chosen"}</Pill>
        <Chips evidence={h.evidence} />
      </div>
      {!ready && (
        <Card className="border-amber-300/25">
          <p className="text-[12.5px] text-amber-100/85">This is a preview. Grow the crop through its care stages at the plot before harvesting.</p>
        </Card>
      )}
      {h.summary && <p className="text-[13px] text-ivory/80">{h.summary}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Section title="Ripe when you see">
          <Card>
            <div className="mb-1 flex items-center gap-1.5 text-cyan-200"><Eye className="h-3.5 w-3.5" /></div>
            <Bullets items={h.ripeness_cues_see} />
          </Card>
        </Section>
        <Section title="Ripe when you feel">
          <Card>
            <div className="mb-1 flex items-center gap-1.5 text-cyan-200"><Hand className="h-3.5 w-3.5" /></div>
            <Bullets items={h.ripeness_cues_feel} />
          </Card>
        </Section>
      </div>
      <Section title="How to harvest"><Bullets items={h.method} /></Section>
      <Section title="Drying & storage"><Bullets items={h.drying_storage} /></Section>
      {h.do_not_store.length > 0 && <Section title="Do not store"><Bullets items={h.do_not_store} tone="safety" /></Section>}
      <Section title="Crop residue"><Bullets items={h.residue_handling} /></Section>
      {h.regeneration.length > 0 && (
        <Section title="Regenerate the soil afterwards">
          {h.regeneration.map((r) => {
            const it = items.find((i) => i.rec.id === r.id);
            return <RecCard key={r.id} rec={r} item={it} here={farm.harvested ? "harvest" : undefined} />;
          })}
        </Section>
      )}
    </GlassPanel>
  );
}
