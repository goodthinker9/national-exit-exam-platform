// Departments that have real sample content (questions exist)
export const SAMPLE_CONTENT_IDS = new Set([
  "computer-science",
  "information-technology",
  "software-engineering",
  "electrical-engineering",
  "pharmacy",
  "biology",
  "accounting",
  "law",
]);

// One accent color + icon name (from Icons.jsx) per field
export const FIELD_META = {
  "engineering":                  { color: "#1675ff", bg: "#e8f0ff", icon: "field-engineering" },
  "health":                        { color: "#12a06a", bg: "#e4f7ef", icon: "field-health"      },
  "natural-computational-sciences":{ color: "#7c3aed", bg: "#f0ebff", icon: "field-science"     },
  "business-economics":            { color: "#d97706", bg: "#fff7e6", icon: "field-business"    },
  "law-governance":                { color: "#0891b2", bg: "#e0f5fb", icon: "field-law"         },
  "humanities":                    { color: "#e53f73", bg: "#ffe7ef", icon: "field-humanities"  },
};

export const courseGroups = {
  Remedial: {
    "Natural Science": ["Mathematics", "Physics", "Chemistry", "Biology", "English"],
    "Social Science": [
      "Mathematics (Social)",
      "Geography",
      "History",
      "Economics",
      "English",
    ],
  },
};

export const remedialCourses = Object.entries(courseGroups.Remedial).flatMap(
  ([stream, names]) => names.map((name) => ({
    id: `remedial-${stream.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}-${name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name,
    stream,
    examType: "Remedial",
  })),
);

export const exitExamTree = [
  { id: "natural-science", type: "stream", name: "Natural Science", parentId: null },
  { id: "social-science", type: "stream", name: "Social Science", parentId: null },

  { id: "engineering", type: "field", name: "Engineering", parentId: "natural-science" },
  { id: "health", type: "field", name: "Health", parentId: "natural-science" },
  {
    id: "natural-computational-sciences",
    type: "field",
    name: "Natural & Computational Sciences",
    parentId: "natural-science",
  },
  { id: "business-economics", type: "field", name: "Business & Economics", parentId: "social-science" },
  { id: "law-governance", type: "field", name: "Law & Governance", parentId: "social-science" },
  { id: "humanities", type: "field", name: "Humanities", parentId: "social-science" },

  { id: "informatics", type: "subgroup", name: "Informatics", parentId: "engineering" },
  { id: "engineering-departments", type: "subgroup", name: "Engineering", parentId: "engineering" },

  { id: "computer-science", type: "department", name: "Computer Science", parentId: "informatics" },
  { id: "information-technology", type: "department", name: "Information Technology", parentId: "informatics" },
  { id: "information-systems", type: "department", name: "Information Systems", parentId: "informatics" },
  { id: "software-engineering", type: "department", name: "Software Engineering", parentId: "informatics" },
  {
    id: "construction-technology-management",
    type: "department",
    name: "Construction Technology & Management (COTM)",
    parentId: "engineering-departments",
  },
  { id: "electrical-engineering", type: "department", name: "Electrical Engineering", parentId: "engineering-departments" },
  { id: "mechanical-engineering", type: "department", name: "Mechanical Engineering", parentId: "engineering-departments" },
  { id: "biomedical-engineering", type: "department", name: "Biomedical Engineering", parentId: "engineering-departments" },

  { id: "medicine", type: "department", name: "Medicine", parentId: "health" },
  { id: "pharmacy", type: "department", name: "Pharmacy", parentId: "health" },
  { id: "nursing", type: "department", name: "Nursing", parentId: "health" },
  { id: "midwifery", type: "department", name: "Midwifery", parentId: "health" },
  { id: "biology", type: "department", name: "Biology", parentId: "natural-computational-sciences" },
  { id: "chemistry", type: "department", name: "Chemistry", parentId: "natural-computational-sciences" },
  { id: "physics", type: "department", name: "Physics", parentId: "natural-computational-sciences" },
  { id: "mathematics", type: "department", name: "Mathematics", parentId: "natural-computational-sciences" },

  { id: "accounting", type: "department", name: "Accounting", parentId: "business-economics" },
  { id: "management", type: "department", name: "Management", parentId: "business-economics" },
  { id: "economics", type: "department", name: "Economics", parentId: "business-economics" },
  { id: "law", type: "department", name: "Law", parentId: "law-governance" },
  { id: "civics-ethics", type: "department", name: "Civics and Ethics", parentId: "law-governance" },
  {
    id: "english-language-literature",
    type: "department",
    name: "English Language and Literature",
    parentId: "humanities",
  },
  { id: "history", type: "department", name: "History", parentId: "humanities" },
  { id: "geography", type: "department", name: "Geography", parentId: "humanities" },
];

export const exitExamCourses = [
  { id: "data-structures", name: "Data Structures", departmentIds: ["computer-science"] },
  { id: "algorithms", name: "Algorithms", departmentIds: ["computer-science"] },
  {
    id: "databases",
    name: "Databases",
    departmentIds: ["computer-science", "information-technology", "software-engineering"],
  },
  {
    id: "computer-networks",
    name: "Computer Networks",
    departmentIds: ["computer-science", "information-technology", "software-engineering"],
  },
  { id: "operating-systems", name: "Operating Systems", departmentIds: ["computer-science"] },
  { id: "web-development", name: "Web Development", departmentIds: ["information-technology"] },
  { id: "cybersecurity", name: "Cybersecurity", departmentIds: ["information-technology"] },
  { id: "software-design", name: "Software Design", departmentIds: ["software-engineering"] },
  { id: "software-testing", name: "Software Testing", departmentIds: ["software-engineering"] },
  { id: "circuit-analysis", name: "Circuit Analysis", departmentIds: ["electrical-engineering"] },
  { id: "electronics", name: "Electronics", departmentIds: ["electrical-engineering"] },
  { id: "power-systems", name: "Power Systems", departmentIds: ["electrical-engineering"] },
  { id: "pharmacology", name: "Pharmacology", departmentIds: ["pharmacy"] },
  { id: "pharmaceutical-chemistry", name: "Pharmaceutical Chemistry", departmentIds: ["pharmacy"] },
  { id: "genetics", name: "Genetics", departmentIds: ["biology"] },
  { id: "ecology", name: "Ecology", departmentIds: ["biology"] },
  { id: "financial-accounting", name: "Financial Accounting", departmentIds: ["accounting"] },
  { id: "cost-accounting", name: "Cost Accounting", departmentIds: ["accounting"] },
  { id: "constitutional-law", name: "Constitutional Law", departmentIds: ["law"] },
  { id: "criminal-law", name: "Criminal Law", departmentIds: ["law"] },
].map((course) => ({ ...course, examType: "Exit exam" }));
