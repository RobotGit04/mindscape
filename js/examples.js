// ─── examples.js ─────────────────────────────────────────────
const EXAMPLES = {
  work:    `reply to Priya about the design review, finish quarterly report by Thursday, fix login bug crashing on mobile, review Arjun's PR, update Notion roadmap, follow up with client on revised proposal, schedule team retro, prep slides for Monday standup, sort out staging deployment issue`,
  life:    `pay electricity bill, dentist appointment overdue, call mom she called twice, gym membership lapsed, fix leaking tap, return headphones, grocery run this weekend, birthday gift for Rohan, renew vehicle insurance, clean out closet before winter`,
  student: `ML assignment due Friday barely started, revise for DBMS test Wednesday, finish networks lab report, get reference letter from Prof Shah, form project group for presentation, read chapters 7-9 applied stats, apply to Google DSC event, sort timetable clash between two practicals, update LinkedIn with internship`,
};

function fillExample(type) {
  const ta = document.getElementById('dumpInput');
  ta.value = EXAMPLES[type];
  updateCharCount();
  ta.focus();
  ta.style.transition = 'background 0.3s';
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  ta.style.background = isDark ? 'rgba(124,106,247,0.05)' : 'rgba(91,33,182,0.04)';
  setTimeout(() => ta.style.background = '', 500);
  // Pre-warm in background for faster submit
  setTimeout(() => prewarmExample(type), 300);
}