// User-supplied demonstration rubric. These weights are not claimed as the
// original research paper's unspecified institutional assessment rubric.
export const rubricVersion = 'demonstration-v1';
export const rubric = Object.freeze([
  ['Abstract and Summary', 5], ['Introduction and Background', 10], ['Problem Statement', 10],
  ['Objectives and Scope', 10], ['Literature Review', 10], ['Methodology and Design', 15],
  ['Implementation and Technical Depth', 15], ['Results and Evaluation', 10],
  ['Conclusion and Future Scope', 5], ['Formatting, References and Clarity', 10],
].map(([name, maxMarks]) => Object.freeze({ name, maxMarks })));

if (rubric.length !== 10 || rubric.reduce((sum, criterion) => sum + criterion.maxMarks, 0) !== 100) throw new Error('The configured rubric must have ten criteria totaling 100.');
