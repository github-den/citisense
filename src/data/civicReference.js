import { SERVICE_CATEGORIES, URDANETA_BARANGAYS } from '../constants/index.js';

export const barangays = URDANETA_BARANGAYS;

function buildService(name, office, category, summary, processingTime, fees = 'None for standard routing and complaint handling. Fees apply only when an official permit, certification, or inspection is required by city rules.') {
  return {
    name,
    office,
    category,
    summary,
    whoMayAvail: `Residents, workers, organizations, and stakeholders who need assistance related to ${name.toLowerCase()}.`,
    requirements: [
      'Valid contact details of the requesting citizen or organization',
      'Exact barangay, site, or landmark involved',
      'Short factual description of the concern or request',
      'Supporting documents, photos, or reference numbers when available',
    ],
    steps: [
      'Submit the request or concern through the responsible office or CitiSense routing',
      'Initial review and validation of submitted details',
      'Assessment, coordination, or field action by the office in charge',
      'Release of update, schedule, or final service response to the citizen',
    ],
    fees,
    processingTime,
    contactHelp: `For follow-up and escalation, coordinate with ${office} and include your feedback number, barangay, and exact location.`,
  };
}

export const charterCategories = [
  {
    key: 'health',
    name: 'Health',
    office: 'City Health Office',
    icon: 'Heartbeat',
    description: 'Primary care, preventive health, sanitation, and community wellness support.',
    services: [
      buildService('Primary care consultation assistance', 'City Health Office', 'Health', 'General health concerns, referrals, and community clinic assistance for basic consultations.', 'Within 1 to 3 working days for routing and schedule confirmation.'),
      buildService('Immunization and vaccination coordination', 'City Health Office', 'Health', 'Routing for routine immunization schedules, vaccine campaigns, and barangay-based health outreach.', 'Within 1 to 5 working days depending on vaccine schedule and program availability.'),
      buildService('Maternal and child wellness support', 'City Health Office', 'Health', 'Prenatal, postnatal, nutrition, and family wellness coordination for mothers and children.', 'Within 1 to 5 working days based on clinic capacity and case urgency.'),
      buildService('Sanitation and public health complaint handling', 'City Health Office', 'Health', 'Verification and routing of complaints related to sanitation, hygiene, and public health risks.', 'Within 3 to 7 working days depending on inspection and coordination needs.'),
    ],
  },
  {
    key: 'infrastructure',
    name: 'Infrastructure',
    office: 'City Engineers Office',
    icon: 'Hammer',
    description: 'Roads, drainage, street lighting, civil works, and structural city infrastructure concerns.',
    services: [
      buildService('Road repair and maintenance request', 'City Engineers Office', 'Infrastructure', 'Assessment and routing of potholes, damaged pavements, and roadway deterioration.', 'Within 3 to 10 working days for inspection, prioritization, and work scheduling.'),
      buildService('Drainage and flood-control concern', 'City Engineers Office', 'Infrastructure', 'Requests involving clogged drainage, runoff, and minor flood-control infrastructure issues.', 'Within 3 to 10 working days depending on field validation and equipment availability.'),
      buildService('Street lighting coordination', 'City Engineers Office', 'Infrastructure', 'Repair, replacement, or verification requests for streetlights in public areas.', 'Within 3 to 7 working days depending on materials and crew schedule.'),
      buildService('Minor civil works assessment', 'City Engineers Office', 'Infrastructure', 'Evaluation of curbs, sidewalks, barriers, and other city-built structures requiring action.', 'Within 5 to 15 working days depending on scope and materials.'),
    ],
  },
  {
    key: 'social-welfare',
    name: 'Social Welfare',
    office: 'City Social Welfare and Development Office',
    icon: 'HandsPraying',
    description: 'Citizen assistance, protection, referral, and social support for vulnerable sectors.',
    services: [
      buildService('Emergency and crisis assistance referral', 'City Social Welfare and Development Office', 'Social Welfare', 'Initial routing for urgent welfare-related requests and protective support.', 'Within 1 to 3 working days, or faster when urgency requires immediate action.'),
      buildService('Senior citizen and PWD support coordination', 'City Social Welfare and Development Office', 'Social Welfare', 'Guidance and referrals for programs, benefits, and service access for senior citizens and persons with disability.', 'Within 2 to 5 working days.'),
      buildService('Solo parent and family assistance inquiry', 'City Social Welfare and Development Office', 'Social Welfare', 'Program inquiries, referrals, and documentation guidance for family welfare services.', 'Within 2 to 5 working days.'),
      buildService('Medical or burial assistance endorsement', 'City Social Welfare and Development Office', 'Social Welfare', 'Support for endorsement, assessment, and next-step guidance on welfare-related assistance requests.', 'Within 3 to 7 working days depending on document completeness.'),
    ],
  },
  {
    key: 'environment',
    name: 'Environment',
    office: 'City Environment and Natural Resources Office',
    icon: 'Leaf',
    description: 'Waste, cleanup, environmental quality, natural resources, and city ecology concerns.',
    services: [
      buildService('Solid waste and garbage collection concern', 'City Environment and Natural Resources Office', 'Environment', 'Routing for missed collection, illegal dumping, and waste-handling concerns.', 'Within 2 to 7 working days depending on route schedule and site validation.'),
      buildService('Environmental cleanup and nuisance report', 'City Environment and Natural Resources Office', 'Environment', 'Reports involving polluted areas, unsanitary surroundings, and public cleanup needs.', 'Within 3 to 10 working days.'),
      buildService('Tree management and vegetation concern', 'City Environment and Natural Resources Office', 'Environment', 'Requests involving unsafe branches, trimming coordination, or site vegetation concerns.', 'Within 5 to 15 working days depending on inspection and permit considerations.'),
      buildService('Air, water, and environmental quality complaint', 'City Environment and Natural Resources Office', 'Environment', 'Complaints involving smoke, odor, contamination, and related environmental impacts.', 'Within 5 to 15 working days depending on inspection and agency coordination.'),
    ],
  },
  {
    key: 'peace-order',
    name: 'Peace & Order',
    office: 'Public Order and Safety Office - Security Division',
    icon: 'ShieldCheck',
    description: 'Security coordination, public safety response, and peace-and-order related civic concerns.',
    services: [
      buildService('Public safety incident reporting', 'Public Order and Safety Office - Security Division', 'Peace & Order', 'Initial intake and coordination for public safety disturbances and incident concerns.', 'Within the same day to 3 working days depending on urgency and incident type.'),
      buildService('Security visibility and patrol request', 'Public Order and Safety Office - Security Division', 'Peace & Order', 'Requests for increased visibility, monitoring, or coordinated public safety presence.', 'Within 1 to 5 working days depending on deployment schedule.'),
      buildService('Public disturbance and nuisance complaint', 'Public Order and Safety Office - Security Division', 'Peace & Order', 'Routing of noise, disorder, obstruction, and local peace-and-order complaints.', 'Within 1 to 5 working days depending on verification and coordination.'),
      buildService('Emergency coordination support', 'Public Order and Safety Office - Security Division', 'Peace & Order', 'Assistance requests involving multi-office safety coordination in urgent situations.', 'Immediate to 3 working days depending on emergency level.'),
    ],
  },
  {
    key: 'public-facilities',
    name: 'Public Facilities',
    office: 'City Engineers Office',
    icon: 'Buildings',
    description: 'Maintenance and usability of city-owned buildings, spaces, and shared public facilities.',
    services: [
      buildService('Public building maintenance request', 'City Engineers Office', 'Public Facilities', 'Concerns involving city halls, offices, covered courts, and other public structures.', 'Within 3 to 10 working days depending on inspection and repair schedule.'),
      buildService('Market, plaza, and public space upkeep concern', 'City Engineers Office', 'Public Facilities', 'Requests related to maintenance, safety, and usability of public-use spaces.', 'Within 3 to 10 working days.'),
      buildService('Public comfort room and sanitation fixture repair', 'City Engineers Office', 'Public Facilities', 'Repair and maintenance concerns involving restrooms and public sanitation fixtures.', 'Within 3 to 7 working days.'),
      buildService('Community facility use and upkeep coordination', 'City Engineers Office', 'Public Facilities', 'Coordination concerns on the readiness, access, and upkeep of city-managed community facilities.', 'Within 3 to 10 working days.'),
    ],
  },
  {
    key: 'economic-services',
    name: 'Economic Services',
    office: 'Business Permits and Licensing Office, City Planning and Development Office',
    icon: 'Storefront',
    description: 'Business permits, local enterprise support, zoning coordination, and economic activity services.',
    services: [
      buildService('Business permit application assistance', 'Business Permits and Licensing Office', 'Economic Services', 'Guidance and routing for new business permit processing concerns and requirements.', 'Within 3 to 10 working days depending on document completeness and approvals.', 'Fees follow official city permit and licensing schedules.'),
      buildService('Business permit renewal support', 'Business Permits and Licensing Office', 'Economic Services', 'Support for renewal-related concerns, scheduling, and document routing.', 'Within 3 to 10 working days depending on volume and completeness.', 'Fees follow official city permit and licensing schedules.'),
      buildService('Zoning and location clearance coordination', 'City Planning and Development Office', 'Economic Services', 'Routing for site-use, zoning, and location compatibility concerns tied to business activity.', 'Within 5 to 15 working days depending on review complexity.', 'Fees may apply based on official zoning and clearance rules.'),
      buildService('Local investment and enterprise inquiry', 'City Planning and Development Office', 'Economic Services', 'Basic assistance for local investment, planning alignment, and enterprise-related concerns.', 'Within 3 to 7 working days.'),
    ],
  },
  {
    key: 'agriculture',
    name: 'Agriculture',
    office: 'City Agriculture Office',
    icon: 'Plant',
    description: 'Farmer support, agri-assistance, livestock concerns, and local agricultural coordination.',
    services: [
      buildService('Farm input and production support inquiry', 'City Agriculture Office', 'Agriculture', 'Assistance and routing for seeds, tools, and production support concerns.', 'Within 3 to 7 working days depending on program schedule and availability.'),
      buildService('Crop pest and disease assistance', 'City Agriculture Office', 'Agriculture', 'Initial assistance and coordination on crop health, infestations, and disease management concerns.', 'Within 3 to 7 working days depending on field validation.'),
      buildService('Livestock and veterinary support referral', 'City Agriculture Office', 'Agriculture', 'Requests involving livestock health, coordination, and veterinary-related support.', 'Within 2 to 7 working days based on case type and availability.'),
      buildService('Farm access and irrigation concern', 'City Agriculture Office', 'Agriculture', 'Routing of irrigation, farm access, and field-support concerns needing city coordination.', 'Within 5 to 15 working days depending on site assessment and coordination.'),
    ],
  },
  {
    key: 'education',
    name: 'Education',
    office: 'City Schools Division Office',
    icon: 'GraduationCap',
    description: 'School coordination, learning access, facilities concerns, and education support services.',
    services: [
      buildService('School facilities concern coordination', 'City Schools Division Office', 'Education', 'Concerns involving classrooms, sanitation, access, and school-site conditions.', 'Within 3 to 10 working days depending on inspection and school coordination.'),
      buildService('Enrollment and learner support inquiry', 'City Schools Division Office', 'Education', 'Guidance on learner-related concerns, referral, and school access support.', 'Within 2 to 5 working days.'),
      buildService('Alternative learning and community education inquiry', 'City Schools Division Office', 'Education', 'Assistance for alternative learning, community-based learning, and education outreach concerns.', 'Within 3 to 7 working days.'),
      buildService('Education program and school service feedback', 'City Schools Division Office', 'Education', 'Feedback routing on school services, delivery gaps, and program implementation concerns.', 'Within 3 to 10 working days.'),
    ],
  },
  {
    key: 'housing',
    name: 'Housing',
    office: 'City Housing Office, City Planning and Development Office',
    icon: 'HouseLine',
    description: 'Housing assistance, site planning, relocation coordination, and settlement-related concerns.',
    services: [
      buildService('Housing assistance and eligibility inquiry', 'City Housing Office', 'Housing', 'Support for housing-related inquiries, requirements, and citizen guidance.', 'Within 3 to 7 working days depending on case and document review.'),
      buildService('Relocation and site development coordination', 'City Housing Office', 'Housing', 'Coordination concerns tied to relocation support, site readiness, and housing programs.', 'Within 5 to 15 working days depending on assessment and program schedule.'),
      buildService('Land use and housing planning referral', 'City Planning and Development Office', 'Housing', 'Referral of planning-related concerns that affect housing suitability and land use.', 'Within 5 to 15 working days.'),
      buildService('Community settlement concern handling', 'City Housing Office', 'Housing', 'Routing of settlement-area concerns requiring city housing intervention or coordination.', 'Within 5 to 15 working days.'),
    ],
  },
  {
    key: 'tourism',
    name: 'Tourism',
    office: 'City Tourism Office',
    icon: 'CompassRose',
    description: 'Tourism information, cultural promotion, destination upkeep, and visitor-support services.',
    services: [
      buildService('Tourism information and visitor assistance', 'City Tourism Office', 'Tourism', 'Public assistance on city tourism sites, activities, and visitor guidance.', 'Within 1 to 3 working days.'),
      buildService('Tourism event and activity coordination', 'City Tourism Office', 'Tourism', 'Basic coordination for tourism-related events, programs, and local promotional activities.', 'Within 3 to 10 working days depending on scope and schedule.'),
      buildService('Tourism site maintenance concern', 'City Tourism Office', 'Tourism', 'Concerns involving cleanliness, visitor experience, and maintenance needs at tourism sites.', 'Within 3 to 10 working days.'),
      buildService('Cultural and heritage promotion inquiry', 'City Tourism Office', 'Tourism', 'Inquiries related to cultural activities, heritage promotion, and tourism-linked identity programs.', 'Within 3 to 7 working days.'),
    ],
  },
  {
    key: 'transportation',
    name: 'Transportation',
    office: 'City Transport and Traffic Management Office',
    icon: 'TrafficSign',
    description: 'Traffic operations, transport flow, road safety, and mobility-related local service concerns.',
    services: [
      buildService('Traffic management complaint', 'City Transport and Traffic Management Office', 'Transportation', 'Concerns involving congestion, unsafe flow, and traffic management gaps.', 'Within 1 to 5 working days depending on urgency and field assessment.'),
      buildService('Public transport terminal and route concern', 'City Transport and Traffic Management Office', 'Transportation', 'Issues involving terminals, loading areas, route behavior, and commuter access.', 'Within 3 to 7 working days.'),
      buildService('Road signage and directional support request', 'City Transport and Traffic Management Office', 'Transportation', 'Requests involving traffic signs, directional support, and safety guidance devices.', 'Within 5 to 15 working days depending on assessment and installation schedule.'),
      buildService('Parking, obstruction, and road-clearing coordination', 'City Transport and Traffic Management Office', 'Transportation', 'Concerns on parking behavior, obstructions, and road-clearing support.', 'Within 1 to 7 working days depending on enforcement and coordination needs.'),
    ],
  },
];

export const charterServicesByCategory = Object.fromEntries(
  charterCategories.map((category) => [category.key, category.services]),
);

export const charterServiceOptions = charterCategories.flatMap((category) =>
  category.services.map((service) => service.name),
);

export const serviceCategoryOptions = SERVICE_CATEGORIES;
