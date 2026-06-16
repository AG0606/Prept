// ════════════════════════════════════════════════════════════
// Report Generator — jsPDF Premium Report Builder
// ════════════════════════════════════════════════════════════

import type { SessionReport } from '@/types';

export async function generateReport(report: SessionReport): Promise<Blob> {
  const jsPDF = (await import('jspdf')).default;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 15;

  // ── COVER ──
  doc.setFillColor(30, 30, 50);
  doc.rect(0, 0, W, 60, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Interview Performance Report', M, 28);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`${report.candidateName}  ·  ${report.jobRole}  ·  ${report.date}`, M, 40);
  doc.text(`Session duration: ${report.duration} minutes`, M, 50);

  // ── OVERALL SCORES ──
  let y = 75;
  doc.setTextColor(30, 30, 50);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Overall Scores', M, y);
  y += 8;

  const scores: [string, number][] = [
    ['Communication', report.overallScores.communication],
    ['Confidence', report.overallScores.confidence],
    ['Technical Depth', report.overallScores.technicalDepth],
    ['Answer Structure', report.overallScores.structure],
    ['Overall', report.overallScores.overall],
  ];

  for (const [label, score] of scores) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(label, M, y);
    const barX = 70, barW = 100, barH = 5;
    doc.setFillColor(220, 220, 220);
    doc.roundedRect(barX, y - 4, barW, barH, 2, 2, 'F');
    const filled = (score / 10) * barW;
    const color = score >= 7 ? [34, 197, 94] : score >= 5 ? [234, 179, 8] : [239, 68, 68];
    doc.setFillColor(color[0], color[1], color[2]);
    doc.roundedRect(barX, y - 4, filled, barH, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 50);
    doc.text(`${score}/10`, barX + barW + 5, y);
    y += 12;
  }

  // ── QUESTION-BY-QUESTION ──
  y += 5;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 50);
  doc.text('Question Analysis', M, y);
  y += 8;

  for (let i = 0; i < report.turns.length; i++) {
    const turn = report.turns[i];
    if (y > 260) { doc.addPage(); y = 20; }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 50);
    const qText = doc.splitTextToSize(`Q${i + 1}: ${turn.question}`, W - M * 2);
    doc.text(qText, M, y);
    y += qText.length * 5 + 2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const aText = doc.splitTextToSize(`Answer: ${turn.answerSummary}`, W - M * 2);
    doc.text(aText, M, y);
    y += aText.length * 4 + 2;

    doc.setFontSize(8);
    const pills = turn.questionType === 'coding' && !turn.followUpAsked
      ? [
          `Quality: ${turn.scores.quality}/10`,
          `Phase: Coding (No Speech)`,
        ]
      : [
          `Quality: ${turn.scores.quality}/10`,
          `Sentiment: ${turn.scores.sentiment}`,
          `WPM: ${turn.scores.wpm}`,
          `Fillers: ${turn.scores.fillerDensity.toFixed(1)}%`,
          `Emotion: ${turn.scores.dominantEmotion}`,
        ];
    let pillX = M;
    for (const pill of pills) {
      doc.setFillColor(235, 237, 254);
      doc.setTextColor(83, 74, 183);
      const pw = doc.getTextWidth(pill) + 6;
      doc.roundedRect(pillX, y - 4, pw, 6, 1, 1, 'F');
      doc.text(pill, pillX + 3, y);
      pillX += pw + 4;
    }
    y += 10;

    if (turn.gaps.length > 0) {
      doc.setTextColor(180, 80, 80);
      doc.text(`Gaps: ${turn.gaps.join(', ')}`, M, y);
      y += 6;
    }
    doc.setDrawColor(220, 220, 220);
    doc.line(M, y, W - M, y);
    y += 6;
  }

  // ── EMOTION SUMMARY ──
  if (y > 240) { doc.addPage(); y = 20; }
  y += 4;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 50);
  doc.text('Emotion & Audio Summary', M, y);
  y += 8;

  const emotionCounts: Record<string, number> = {};
  for (const p of report.emotionTimeline) {
    emotionCounts[p.emotion] = (emotionCounts[p.emotion] ?? 0) + 1;
  }
  const total = report.emotionTimeline.length || 1;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  for (const [emotion, count] of Object.entries(emotionCounts)) {
    doc.text(`${emotion}: ${((count / total) * 100).toFixed(0)}% of session`, M, y);
    y += 6;
  }
  y += 4;
  doc.text(`Average speaking pace: ${report.audioMetrics.avgWpm} WPM  (ideal: 120–160)`, M, y);
  y += 6;
  doc.text(`Average loudness: ${report.audioMetrics.avgLoudnessDb.toFixed(1)} dB`, M, y);
  y += 10;

  // ── RECOMMENDATIONS ──
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 50);
  doc.text('Recommendations', M, y);
  y += 8;

  for (const rec of report.recommendations) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(`• ${rec}`, W - M * 2 - 4);
    doc.text(lines, M + 2, y);
    y += lines.length * 5 + 3;
  }

  // ── AI IMPRESSION ──
  if (y > 240) { doc.addPage(); y = 20; }
  y += 4;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 50);
  doc.text("Interviewer's Final Impression", M, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(80, 80, 80);
  const impLines = doc.splitTextToSize(report.geminiImpression, W - M * 2);
  doc.text(impLines, M, y);

  return doc.output('blob');
}
