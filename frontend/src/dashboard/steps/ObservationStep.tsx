import { Feather } from "lucide-react";
import ObservationForm from "../../components/ObservationForm";
import { Panel } from "../../components/ui";

export default function ObservationStep() {
  return (
    <div className="grid gap-5">
      <Panel className="hero-ring relative overflow-hidden p-5 sm:p-7">
        <span className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-cyan/20 to-violet/10 blur-3xl" aria-hidden />
        <div className="relative mb-5 flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan/25 to-violet/25 text-cyan-100">
            <Feather className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h3 className="font-heading text-lg font-semibold text-ivory">Field journal entry</h3>
            <p className="text-sm text-mist">
              Write as you would to a friend. You don't need instruments — what you see, feel and notice is enough.
            </p>
          </div>
        </div>
        <div className="relative">
          <ObservationForm />
        </div>
      </Panel>
    </div>
  );
}
