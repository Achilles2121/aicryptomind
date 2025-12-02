import React, { useContext } from "react";
import { SubscriptionContext } from "../../context/SubscriptionContext";
import { Badge } from "../../components/Badge";
import { formatDate } from "../../lib/formatters";

const plans = [
  { id: "trial", title: "Trial", description: "7-day full preview", color: "blue" },
  { id: "basic", title: "Basic", description: "Core charts & ETF desk", color: "amber" },
  { id: "elite", title: "Elite", description: "All features unlocked", color: "green" },
];

export function PlanSelector() {
  const { plan, setPlan, trialEndsAt, trialDaysLeft, trialActive, trialExpired, startTrial, eliteTier } =
    useContext(SubscriptionContext);

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {plans.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setPlan(item.id)}
          className={`rounded-xl border p-3 text-left transition ${
            plan === item.id
              ? "border-emerald-500/80 bg-emerald-900/30"
              : "border-slate-800/70 bg-slate-900/50 hover:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <h4 className="text-base font-semibold text-white">{item.title}</h4>
            <Badge tone={item.color}>{plan === item.id ? "Active" : "Select"}</Badge>
          </div>
          <p className="text-sm text-slate-400">{item.description}</p>
          {item.id === "trial" ? (
            <div className="mt-2 space-y-1 text-xs text-slate-300">
              {trialActive ? (
                <p>
                  {trialDaysLeft} days left • Ends {trialEndsAt ? formatDate(trialEndsAt) : ""}
                </p>
              ) : trialExpired ? (
                <p className="text-amber-300">Trial expired • Upgrade to continue</p>
              ) : (
                <p>Start your 7-day trial to unlock Elite features.</p>
              )}
              {!trialActive && !trialExpired ? (
                <span className="inline-block rounded bg-emerald-600/80 px-3 py-1 text-white">
                  Start 7-day Trial
                </span>
              ) : null}
            </div>
          ) : null}
          {item.id === "elite" ? (
            <p className="text-xs text-emerald-200">
              {eliteTier ? "Elite benefits active (trial or paid)" : "Unlock everything"}
            </p>
          ) : null}
        </button>
      ))}
      {!trialActive && !trialExpired ? (
        <button
          type="button"
          onClick={startTrial}
          className="rounded-xl border border-emerald-600/80 bg-emerald-900/40 p-3 text-left text-sm font-semibold text-white hover:border-emerald-500 md:col-span-3"
        >
          Start 7-day Trial
        </button>
      ) : null}
    </div>
  );
}
