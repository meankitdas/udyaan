export type Problem = {
  slug: string;
  id: string;
  title: string;
  category: "Food" | "Water" | "Waste";
  type: string;
  description: string;
  image: string;
  imageAlt: string;
  source: string;
  status: "Proposed";
  stage: string;
  skills: string[];
  context: string;
  user: string;
  whyNow: string;
  ask: string;
  constraints: string[];
  success: string[];
  support: string;
};

export const problems: Problem[] = [
  {
    slug: "precision-farming", id: "UDY-001", title: "Help farmers act on what their crops need.",
    category: "Food", type: "Sensing & automation", status: "Proposed", stage: "Problem scoping",
    description: "Turn field observations into timely, targeted decisions about crop care.",
    image: "/udyaan-aerial-poster.jpg", imageAlt: "Aerial view of cultivated fields", source: "Udyaan precision agriculture track",
    skills: ["Engineering", "Data & AI", "Design", "Operations"],
    context: "Crop conditions change across a field. Uniform monitoring and treatment can miss local stress or use resources where they are not needed. The existing drone and robot farming track provides a starting point for investigating this gap.",
    user: "Growers and field operators who need useful crop information without adding complexity to daily work.",
    whyNow: "Sensing tools are becoming more accessible, but collecting data is not the same as helping a grower make a better decision.",
    ask: "Investigate how field observations can become a clear, actionable recommendation. Test the approach with a small, measurable prototype; do not assume a drone is the only answer.",
    constraints: ["Respect aviation rules, field safety and operator permissions.", "Account for connectivity, maintenance and total operating cost.", "Agree access to field data and testing sites before collecting information."],
    success: ["Define a baseline for the current monitoring or treatment process.", "Compare the proposed approach against that baseline using documented field observations.", "Demonstrate that an intended operator can understand and act on the output."],
    support: "Relevant technical and domain mentorship can be discussed during scoping. Field access, equipment and data availability must be agreed before the build.",
  },
  {
    slug: "urban-microgreens", id: "UDY-002", title: "Make small-space growing commercially useful.",
    category: "Food", type: "Product & business model", status: "Proposed", stage: "Problem scoping",
    description: "Explore a reliable microgreens system that works for both growers and buyers.",
    image: "/udyaan-greenhouse.jpg", imageAlt: "Leafy crops growing in a controlled greenhouse", source: "Udyaan vertical microgreens track",
    skills: ["Life sciences", "Business", "Design", "Operations"],
    context: "Growing food in a compact space is only one part of the challenge. Consistent quality, production cost, food safety and reliable demand determine whether an urban growing system can continue.",
    user: "Small-space growers and local food businesses looking for a dependable supply of fresh produce.",
    whyNow: "A production experiment becomes useful only when the growing process and the route to a customer work together.",
    ask: "Investigate a small-scale microgreens production and distribution model. Test the assumptions behind growing consistency, buyer needs and unit economics.",
    constraints: ["Work within an agreed footprint, energy budget and production schedule.", "Follow appropriate hygiene and food-safety requirements.", "Include packaging, labour, spoilage and delivery in cost estimates."],
    success: ["Document a repeatable growing cycle and the quality of its output.", "Validate buyer requirements through direct conversations or approved trials.", "Produce transparent unit economics, including limitations and sensitivity to costs."],
    support: "Life-science, food-technology and business guidance can be matched to the agreed brief. Growing facilities and buyer access require confirmation.",
  },
  {
    slug: "water-efficient-growing", id: "UDY-003", title: "Grow more with every litre of water.",
    category: "Water", type: "Systems & resource efficiency", status: "Proposed", stage: "Problem scoping",
    description: "Test how a water-efficient growing system performs outside an ideal lab setup.",
    image: "/udyaan-greenhouse.jpg", imageAlt: "Greenhouse crops under a protected growing structure", source: "Udyaan hydro-aeroponics track",
    skills: ["Engineering", "Life sciences", "Data & AI", "Operations"],
    context: "Hydroponic and aeroponic systems can change how water and nutrients reach a crop. Their practical value depends on reliability, maintenance, crop health and the resources used across a complete growing cycle.",
    user: "Growers working with constrained water supplies or limited growing space.",
    whyNow: "A water-saving claim needs a credible comparison. Measuring a complete system can reveal trade-offs that a prototype alone does not show.",
    ask: "Frame and test a growing approach that reduces avoidable water use while maintaining a useful crop output. Measure performance against a clearly defined baseline.",
    constraints: ["Track water, nutrient and energy use together.", "Plan for pump failure, maintenance and safe handling of nutrients.", "Use an agreed crop, comparison method and observation period."],
    success: ["Record water use per unit of usable crop output.", "Document crop health, system downtime and maintenance effort.", "Explain trade-offs and whether the approach merits a larger trial."],
    support: "Technical, research and growing-system guidance can support an approved trial. Access to equipment and growing space is subject to project arrangements.",
  },
  {
    slug: "organic-waste-to-value", id: "UDY-004", title: "Give organic waste a useful next life.",
    category: "Waste", type: "Circular systems", status: "Proposed", stage: "Problem scoping",
    description: "Connect waste collection, conversion and demand into a viable circular system.",
    image: "/lab-soil.jpg", imageAlt: "Soil and organic growing material", source: "Udyaan circular bioeconomy track",
    skills: ["Life sciences", "Engineering", "Business", "Policy", "Operations"],
    context: "A waste-to-value process depends on more than conversion technology. Feedstock quality, collection logistics, safety, compliance and a use for the output all shape whether the system works.",
    user: "Organic-waste generators, collection operators and potential users of recovered resources.",
    whyNow: "Waste becomes a resource only when the entire chain is practical. The circular bioeconomy track offers a starting point for testing that chain.",
    ask: "Investigate one defined organic-waste stream and a useful recovery pathway. Compare the operational and commercial assumptions before proposing a larger system.",
    constraints: ["Identify contamination risks and safe handling requirements.", "Account for collection distance, storage, permits and process safety.", "Do not run gas or biological processing experiments without appropriate supervision."],
    success: ["Map the quantity, quality and variability of an agreed waste stream.", "Document a mass balance, operating assumptions and realistic costs.", "Identify a credible user for the output and a responsible next-stage test."],
    support: "Domain, process and business mentors can help frame the work. Any physical trial needs approved facilities, permissions and safety supervision.",
  },
];

export const engineStages = [
  { title: "Problem", text: "A meaningful challenge enters from industry, research or a builder." },
  { title: "People", text: "Students bring curiosity, capability and a reason to care." },
  { title: "Team", text: "The problem brings the right disciplines together." },
  { title: "Build", text: "Research becomes a prototype, with mentors in the loop." },
  { title: "Validate", text: "Test the solution with users, evidence and real constraints." },
  { title: "Outcome", text: "Adoption, research or a credible next step for the team." },
  { title: "Venture", text: "When the evidence supports it, keep building." },
];

export const buildStages = [
  ["Understand", "Learn the context, the user and what has already been attempted."],
  ["Investigate", "Talk to people closest to the problem. Gather evidence and test assumptions."],
  ["Frame", "Define a focused problem statement and agree what success would look like."],
  ["Build", "Create the simplest prototype, process, model or service that tests the idea."],
  ["Test", "Put the solution into a real context and observe what happens."],
  ["Iterate", "Use the evidence to improve. Keep what works and change what does not."],
  ["Validate", "Decide whether the technical, user and commercial evidence supports continuation."],
  ["Present", "Show the approach, limitations, proof and a clear next step."],
];

export const capabilities = [
  ["Engineering & technology", "Make the system work."],
  ["Data & AI", "Find signals. Test assumptions."],
  ["Design & creative practice", "Make the solution useful to people."],
  ["Business & commerce", "Connect value to a viable model."],
  ["Life sciences & research", "Bring scientific depth to the build."],
  ["Food & applied technology", "Turn knowledge into reliable processes."],
  ["Operations & systems", "Make it repeatable outside the prototype."],
  ["Policy & human context", "Understand who is affected and what must be respected."],
];