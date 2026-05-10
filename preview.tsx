import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Home,
  Wallet,
  PiggyBank,
  Bell,
  Target,
  Mic,
  Send,
  Camera,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

/**
 * HOUSEHOLD FINANCE DASHBOARD
 * ---------------------------------------------
 * Mobile-first React single file app
 * No forms — conversational AI only
 * Persistent storage via localStorage wrapper
 * Claude API integration scaffold included
 * TailwindCSS ready
 */

const STORAGE_KEY = "sg-household-finance-v1";

const defaultData = {
  household: {
    incomes: [],
    expenses: [],
  },

  individuals: {
    me: {
      name: "Me",
      savingsHistory: [],
    },
    husband: {
      name: "Husband",
      savingsHistory: [],
    },
  },

  investments: [],

  rateTable: {
    ssb: 3.04,
    tbill6m: 3.1,
    tbill1y: 3.2,
    fd: [
      { bank: "UOB", tenure: "6M", rate: 3.3 },
      { bank: "OCBC", tenure: "6M", rate: 3.15 },
      { bank: "DBS", tenure: "12M", rate: 3.0 },
      { bank: "Maybank", tenure: "12M", rate: 3.25 },
    ],
  },

  reminders: {
    husbandParents: 1700,
    myParents: 1200,
    jointTransfer: 3000,
  },

  retirement: {
    myAge: 33,
    husbandAge: 36,
    retirementAge: 40,
    children: 2,
    targetMonthlyExpense: 9000,
    netWorth: 420000,
  },

  messages: [
    {
      role: "assistant",
      content:
        "Hi 👋 I'm your household finance assistant. You can tell me things naturally like 'I received my salary $8500', 'We placed $20k FD at UOB', or upload a statement photo.",
    },
  ],
};

const categories = [
  "Food",
  "Transport",
  "Shopping",
  "Healthcare",
  "Kids",
  "Parents",
  "Joint Household",
  "Investments",
  "Others",
];

const COLORS = [
  "#FDBA74",
  "#F9A8D4",
  "#A5B4FC",
  "#86EFAC",
  "#67E8F9",
  "#FCA5A5",
  "#C4B5FD",
  "#FDE68A",
];

const storage = {
  get() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : defaultData;
    } catch {
      return defaultData;
    }
  },

  set(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
};

function currency(num = 0) {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    maximumFractionDigits: 0,
  }).format(num);
}

function App() {
  const [data, setData] = useState(storage.get());
  const [tab, setTab] = useState("dashboard");
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    storage.set(data);
  }, [data]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [data.messages]);

  const monthlyIncome = useMemo(() => {
    return data.household.incomes.reduce((a, b) => a + b.amount, 0);
  }, [data.household.incomes]);

  const monthlyExpenses = useMemo(() => {
    return data.household.expenses.reduce((a, b) => a + b.amount, 0);
  }, [data.household.expenses]);

  const cashFlow = monthlyIncome - monthlyExpenses;

  const pieData = useMemo(() => {
    const grouped = {};

    data.household.expenses.forEach((e) => {
      grouped[e.category] = (grouped[e.category] || 0) + e.amount;
    });

    return Object.entries(grouped).map(([name, value]) => ({
      name,
      value,
    }));
  }, [data.household.expenses]);

  const investmentTotal = data.investments.reduce(
    (a, b) => a + b.amount,
    0
  );

  const projectedInterest = data.investments.reduce(
    (a, b) => a + (b.projectedReturn || 0),
    0
  );

  async function callClaude(messages, imageBase64 = null) {
    /**
     * CLAUDE SONNET API INTEGRATION
     * ---------------------------------
     * Replace YOUR_API_KEY_HERE
     */

    try {
      const response = await fetch(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "YOUR_API_KEY_HERE",
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1200,
            messages,
          }),
        }
      );

      const json = await response.json();

      return json.content?.[0]?.text || "";
    } catch (err) {
      console.error(err);

      return "Sorry, I couldn't process that right now.";
    }
  }

  async function processMessage(text) {
    if (!text.trim()) return;

    const newMessages = [
      ...data.messages,
      {
        role: "user",
        content: text,
      },
    ];

    setData((d) => ({
      ...d,
      messages: newMessages,
    }));

    setInput("");

    /**
     * LOCAL INTENT PARSER
     * -----------------------
     * Fast client-side handling
     */

    const lower = text.toLowerCase();

    // Salary
    if (lower.includes("salary")) {
      const amt = extractAmount(text);

      if (amt) {
        setPendingAction({
          type: "salary",
          payload: {
            amount: amt,
            date: new Date().toISOString(),
          },
        });

        addAssistant(
          `I detected a salary income of ${currency(
            amt
          )}. Would you like me to save this under household income?`
        );

        return;
      }
    }

    // Expense
    if (
      lower.includes("spent") ||
      lower.includes("paid") ||
      lower.includes("fairprice")
    ) {
      const amt = extractAmount(text);

      if (amt) {
        setPendingAction({
          type: "expense",
          payload: {
            amount: amt,
            category: inferCategory(lower),
            merchant: text,
            date: new Date().toISOString(),
          },
        });

        addAssistant(
          `I found an expense of ${currency(
            amt
          )} under "${
            inferCategory(lower)
          }". Save this transaction?`
        );

        return;
      }
    }

    // Fixed Deposit
    if (lower.includes("fd")) {
      const amt = extractAmount(text);
      const rate = extractPercentage(text);

      const bank =
        ["uob", "dbs", "ocbc", "maybank"].find((b) =>
          lower.includes(b)
        ) || "Bank";

      if (amt) {
        setPendingAction({
          type: "investment",
          payload: {
            type: "Fixed Deposit",
            institution: bank.toUpperCase(),
            amount: amt,
            rate: rate || 3,
            startDate: new Date().toISOString(),
            maturityDate: addMonths(new Date(), 6),
            projectedReturn:
              amt * ((rate || 3) / 100) * (6 / 12),
          },
        });

        addAssistant(
          `I found a ${currency(
            amt
          )} fixed deposit at ${bank.toUpperCase()}.${
            rate ? ` Rate: ${rate}% p.a.` : ""
          } Save this investment?`
        );

        return;
      }
    }

    if (
      lower.includes("yes") &&
      pendingAction
    ) {
      confirmPendingAction();
      return;
    }

    /**
     * CLAUDE FALLBACK
     */

    const reply = await callClaude([
      {
        role: "user",
        content: `
You are a warm Singapore household finance assistant.

Extract:
- intent
- structured data
- follow-up questions if missing

User message:
${text}
        `,
      },
    ]);

    addAssistant(reply);
  }

  function confirmPendingAction() {
    if (!pendingAction) return;

    const p = pendingAction;

    setData((d) => {
      const updated = { ...d };

      if (p.type === "salary") {
        updated.household.incomes.push({
          ...p.payload,
          id: Date.now(),
        });
      }

      if (p.type === "expense") {
        updated.household.expenses.push({
          ...p.payload,
          id: Date.now(),
        });
      }

      if (p.type === "investment") {
        updated.investments.push({
          ...p.payload,
          id: Date.now(),
        });
      }

      updated.messages.push({
        role: "assistant",
        content: "Done ✨ Saved successfully.",
      });

      return updated;
    });

    setPendingAction(null);
  }

  function addAssistant(content) {
    setData((d) => ({
      ...d,
      messages: [
        ...d.messages,
        {
          role: "assistant",
          content,
        },
      ],
    }));
  }

  function extractAmount(text) {
    const match = text.match(/(\d+[.,]?\d*)/g);

    if (!match) return null;

    return parseFloat(match[0].replace(",", ""));
  }

  function extractPercentage(text) {
    const match = text.match(/(\d+(\.\d+)?)%/);

    return match ? parseFloat(match[1]) : null;
  }

  function inferCategory(text) {
    if (text.includes("fairprice")) return "Food";
    if (text.includes("grab")) return "Transport";
    if (text.includes("clinic")) return "Healthcare";

    return "Others";
  }

  function addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);

    return d.toISOString();
  }

  function startVoiceInput() {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Voice recognition isn't supported on this browser."
      );
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-SG";
    recognition.interimResults = false;

    recognition.onstart = () => setListening(true);

    recognition.onend = () => setListening(false);

    recognition.onresult = (event) => {
      const transcript =
        event.results[0][0].transcript;

      setInput(transcript);
    };

    recognition.start();
  }

  function renderTab() {
    switch (tab) {
      case "dashboard":
        return (
          <DashboardTab
            income={monthlyIncome}
            expenses={monthlyExpenses}
            cashFlow={cashFlow}
            pieData={pieData}
          />
        );

      case "investments":
        return (
          <InvestmentsTab
            data={data}
          />
        );

      case "spending":
        return (
          <SpendingTab
            pieData={pieData}
            expenses={data.household.expenses}
          />
        );

      case "goals":
        return (
          <GoalsTab
            retirement={data.retirement}
            savings={cashFlow}
          />
        );

      case "reminders":
        return (
          <RemindersTab
            reminders={data.reminders}
            investments={data.investments}
          />
        );

      default:
        return null;
    }
  }

  return (
    <div className="bg-neutral-100 min-h-screen flex justify-center">
      <div className="w-full max-w-[430px] bg-gradient-to-b from-orange-50 via-white to-white min-h-screen relative pb-40">
        {/* HEADER */}
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-neutral-500">
                Household Finance
              </div>

              <div className="text-2xl font-bold text-neutral-800">
                Good afternoon ☀️
              </div>
            </div>

            <div className="bg-orange-100 rounded-2xl px-3 py-2 text-orange-700 text-sm font-medium">
              Singapore
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="px-4 pb-28">
          {renderTab()}
        </div>

        {/* CHAT LAYER */}
        <div className="fixed bottom-16 left-0 right-0 flex justify-center">
          <div className="w-full max-w-[430px] px-3">
            <div className="bg-white rounded-3xl shadow-2xl border border-neutral-200 overflow-hidden">
              <div className="max-h-56 overflow-y-auto p-4 space-y-3">
                {data.messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${
                      m.role === "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[82%] rounded-3xl px-4 py-3 text-sm leading-relaxed ${
                        m.role === "user"
                          ? "bg-orange-500 text-white"
                          : "bg-neutral-100 text-neutral-800"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}

                <div ref={messagesEndRef} />
              </div>

              {pendingAction && (
                <div className="px-4 pb-2">
                  <button
                    onClick={confirmPendingAction}
                    className="w-full bg-emerald-500 text-white rounded-2xl py-3 font-semibold"
                  >
                    Confirm & Save
                  </button>
                </div>
              )}

              <div className="border-t border-neutral-100 p-3 flex items-center gap-2">
                <button
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                    listening
                      ? "bg-red-500 text-white"
                      : "bg-orange-100 text-orange-700"
                  }`}
                  onClick={startVoiceInput}
                >
                  <Mic size={18} />
                </button>

                <button className="w-11 h-11 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-600">
                  <Camera size={18} />
                </button>

                <input
                  value={input}
                  onChange={(e) =>
                    setInput(e.target.value)
                  }
                  placeholder="Tell me what happened..."
                  className="flex-1 bg-neutral-100 rounded-2xl px-4 py-3 outline-none text-sm"
                />

                <button
                  onClick={() =>
                    processMessage(input)
                  }
                  className="w-11 h-11 rounded-2xl bg-orange-500 text-white flex items-center justify-center"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM NAV */}
        <div className="fixed bottom-0 left-0 right-0 flex justify-center">
          <div className="w-full max-w-[430px] bg-white border-t border-neutral-200 px-2 py-2 flex justify-around">
            <NavButton
              active={tab === "dashboard"}
              icon={<Home size={20} />}
              label="Dashboard"
              onClick={() => setTab("dashboard")}
            />

            <NavButton
              active={tab === "investments"}
              icon={<PiggyBank size={20} />}
              label="Investments"
              onClick={() => setTab("investments")}
            />

            <NavButton
              active={tab === "spending"}
              icon={<Wallet size={20} />}
              label="Spending"
              onClick={() => setTab("spending")}
            />

            <NavButton
              active={tab === "goals"}
              icon={<Target size={20} />}
              label="Goals"
              onClick={() => setTab("goals")}
            />

            <NavButton
              active={tab === "reminders"}
              icon={<Bell size={20} />}
              label="Reminders"
              onClick={() => setTab("reminders")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardTab({
  income,
  expenses,
  cashFlow,
  pieData,
}) {
  return (
    <div className="space-y-5">
      <HeroCard
        title="This Month"
        subtitle={`You earned ${currency(
          income
        )} and saved ${currency(cashFlow)}.`}
      />

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Income"
          value={currency(income)}
        />

        <StatCard
          label="Expenses"
          value={currency(expenses)}
        />
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-sm">
        <div className="font-semibold mb-4">
          Spending Breakdown
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                outerRadius={90}
              >
                {pieData.map((_, index) => (
                  <Cell
                    key={index}
                    fill={
                      COLORS[
                        index % COLORS.length
                      ]
                    }
                  />
                ))}
              </Pie>

              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function InvestmentsTab({ data }) {
  const upcoming = data.investments.filter((i) => {
    const days =
      (new Date(i.maturityDate) -
        new Date()) /
      (1000 * 60 * 60 * 24);

    return days < 30;
  });

  return (
    <div className="space-y-4">
      <HeroCard
        title={currency(
          data.investments.reduce(
            (a, b) => a + b.amount,
            0
          )
        )}
        subtitle="Total portfolio value"
      />

      {upcoming.map((i, idx) => (
        <div
          key={idx}
          className="bg-amber-100 border border-amber-200 rounded-3xl p-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-700" />

            <div>
              <div className="font-semibold text-amber-900">
                {currency(i.amount)} at{" "}
                {i.institution}
              </div>

              <div className="text-sm text-amber-800 mt-1">
                Matures soon — want me to
                recommend where to reinvest?
              </div>
            </div>
          </div>
        </div>
      ))}

      {data.investments.map((i, idx) => (
        <div
          key={idx}
          className="bg-white rounded-3xl p-5 shadow-sm"
        >
          <div className="flex justify-between">
            <div>
              <div className="font-semibold">
                {i.institution}
              </div>

              <div className="text-sm text-neutral-500">
                {i.type}
              </div>
            </div>

            <div className="text-right">
              <div className="font-bold">
                {currency(i.amount)}
              </div>

              <div className="text-sm text-emerald-600">
                {i.rate}% p.a.
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-between text-sm">
            <div>
              <div className="text-neutral-400">
                Maturity
              </div>

              <div>
                {new Date(
                  i.maturityDate
                ).toLocaleDateString()}
              </div>
            </div>

            <div>
              <div className="text-neutral-400">
                Projected Return
              </div>

              <div>
                {currency(
                  i.projectedReturn
                )}
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="bg-gradient-to-r from-orange-400 to-pink-400 rounded-3xl p-5 text-white">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={18} />
          <div className="font-semibold">
            Best Current Pick
          </div>
        </div>

        <div className="text-2xl font-bold">
          UOB FD — 6M @ 3.3%
        </div>

        <div className="mt-2 text-sm text-orange-50">
          Highest short-term guaranteed rate with
          strong liquidity and low risk.
        </div>
      </div>
    </div>
  );
}

function SpendingTab({
  pieData,
  expenses,
}) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl p-5 shadow-sm">
        <div className="font-semibold mb-3">
          Category Spending
        </div>

        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pieData}>
              <XAxis dataKey="name" hide />
              <Tooltip />
              <Bar dataKey="value" radius={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-3">
        {expenses.map((e, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl p-4 flex justify-between"
          >
            <div>
              <div className="font-medium">
                {e.category}
              </div>

              <div className="text-sm text-neutral-500">
                {e.merchant}
              </div>
            </div>

            <div className="font-semibold">
              {currency(e.amount)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoalsTab({
  retirement,
  savings,
}) {
  const targetNestEgg =
    retirement.targetMonthlyExpense *
    12 *
    25;

  const progress =
    (retirement.netWorth /
      targetNestEgg) *
    100;

  return (
    <div className="space-y-5">
      <HeroCard
        title={`${progress.toFixed(0)}%`}
        subtitle="Of the way to financial freedom"
      />

      <div className="bg-white rounded-3xl p-5 shadow-sm">
        <div className="flex justify-between mb-2">
          <div className="text-sm text-neutral-500">
            Progress
          </div>

          <div className="font-semibold">
            {currency(
              retirement.netWorth
            )} /{" "}
            {currency(targetNestEgg)}
          </div>
        </div>

        <div className="h-4 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-400 to-pink-400"
            style={{
              width: `${Math.min(
                progress,
                100
              )}%`,
            }}
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-sm">
        <div className="font-semibold mb-4">
          Savings Projection
        </div>

        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={[
                {
                  month: "Now",
                  savings:
                    retirement.netWorth,
                },
                {
                  month: "1Y",
                  savings:
                    retirement.netWorth +
                    savings * 12,
                },
                {
                  month: "3Y",
                  savings:
                    retirement.netWorth +
                    savings * 36,
                },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <Tooltip />
              <Line
                dataKey="savings"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-3">
        <WhatIfCard text="Spend $500 less per month" />
        <WhatIfCard text="10% salary increment" />
        <WhatIfCard text="Extra $200 monthly interest" />
      </div>
    </div>
  );
}

function RemindersTab({
  reminders,
  investments,
}) {
  return (
    <div className="space-y-4">
      <ReminderCard
        title="Parents Transfer"
        amount={currency(
          reminders.husbandParents
        )}
      />

      <ReminderCard
        title="My Parents"
        amount={currency(
          reminders.myParents
        )}
      />

      <ReminderCard
        title="Joint Account"
        amount={currency(
          reminders.jointTransfer
        )}
      />

      {investments.map((i, idx) => (
        <ReminderCard
          key={idx}
          title={`${i.institution} FD`}
          amount={`Matures ${new Date(
            i.maturityDate
          ).toLocaleDateString()}`}
        />
      ))}
    </div>
  );
}

function HeroCard({
  title,
  subtitle,
}) {
  return (
    <div className="bg-gradient-to-r from-orange-400 via-pink-400 to-orange-500 rounded-[28px] p-6 text-white shadow-lg">
      <div className="text-3xl font-bold">
        {title}
      </div>

      <div className="mt-2 text-orange-50">
        {subtitle}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
}) {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm">
      <div className="text-sm text-neutral-500">
        {label}
      </div>

      <div className="text-xl font-bold mt-2">
        {value}
      </div>
    </div>
  );
}

function ReminderCard({
  title,
  amount,
}) {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm flex items-center justify-between">
      <div>
        <div className="font-semibold">
          {title}
        </div>

        <div className="text-sm text-neutral-500 mt-1">
          Monthly reminder
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="font-semibold">
          {amount}
        </div>

        <ChevronRight
          size={18}
          className="text-neutral-400"
        />
      </div>
    </div>
  );
}

function WhatIfCard({ text }) {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm flex items-center justify-between">
      <div>
        <div className="font-medium">
          {text}
        </div>

        <div className="text-sm text-neutral-500 mt-1">
          Interactive simulation
        </div>
      </div>

      <TrendingUp className="text-orange-500" />
    </div>
  );
}

function NavButton({
  icon,
  label,
  active,
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition ${
        active
          ? "text-orange-500"
          : "text-neutral-400"
      }`}
    >
      {icon}

      <div className="text-[11px] font-medium">
        {label}
      </div>
    </button>
  );
}

export default App;