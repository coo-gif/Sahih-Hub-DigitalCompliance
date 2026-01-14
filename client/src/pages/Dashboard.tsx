import { useDashboardStats, useComplianceAlerts, useRecentActivity } from "@/hooks/use-dashboard";
import { useMyTasks, useCompleteTask, useAllDocumentTasks, usePokeTask } from "@/hooks/use-tasks";
import { useUsers, useActiveUsers, useActivityHeartbeat } from "@/hooks/use-users";
import { useAuth } from "@/hooks/use-auth";
import { useApproveEmployee, useRejectEmployee, useSubmitEmployeeForApproval } from "@/hooks/use-employees";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle,
  Clock,
  Plus,
  ArrowRight,
  ClipboardList,
  FileCheck,
  FilePen,
  FileSignature,
  LayoutDashboard,
  Activity,
  Sparkles,
  TrendingUp,
  Shield,
  Zap,
  Sun,
  Moon,
  CloudSun,
  Target,
  Award,
  BarChart3,
  RefreshCw,
  Bell,
  Eye,
  Download,
  Unlock,
  X,
  BookOpen,
  Lightbulb,
  GraduationCap
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { useState, useEffect, useMemo, useId } from "react";
import type { MyTask } from "@/hooks/use-tasks";
import quoteImage1 from "@assets/generated_images/quality_certification_rings_abstract.png";
import quoteImage2 from "@assets/generated_images/excellence_network_visualization.png";
import quoteImage3 from "@assets/generated_images/continuous_improvement_ribbons.png";
import quoteImage4 from "@assets/generated_images/quality_standards_shield.png";
import quoteImage5 from "@assets/generated_images/global_standards_globe.png";
import sahihLogoPath from "@assets/sahih_logo-1.png";
import { HubEebiFullBody } from "@/components/BuddyAvatar";

const motivationalQuotes = [
  { quote: "Quality is not an act, it is a habit.", image: quoteImage1 },
  { quote: "Excellence is not a destination but a continuous journey.", image: quoteImage2 },
  { quote: "The quality of our work reflects the quality of ourselves.", image: quoteImage3 },
  { quote: "Standards are not made to be broken, but to be exceeded.", image: quoteImage4 },
  { quote: "Compliance today means confidence tomorrow.", image: quoteImage5 },
  { quote: "Every document tells a story of excellence.", image: quoteImage1 },
  { quote: "Precision in process, perfection in outcome.", image: quoteImage2 },
  { quote: "Your commitment to quality is your signature of excellence.", image: quoteImage3 },
];

const iso17021Clauses = [
  {
    clause: "4.1",
    title: "General Principles",
    shortTip: "Impartiality is the foundation of certification credibility.",
    article: `**Understanding ISO 17021-1:2015 Clause 4.1 - General Principles**

The foundation of any certification body's credibility rests upon its adherence to general principles that ensure trust and reliability in the certification process.

**Key Requirements:**
- Certification bodies must be impartial and objective in all certification activities
- Decisions must be based on objective evidence of conformity
- The certification process must be consistent, fair, and transparent

**Implementation Tips from Sahih Certifications:**
1. Establish clear policies that demonstrate commitment to impartiality
2. Document all decisions with supporting evidence
3. Ensure all staff understand their role in maintaining objectivity
4. Regular training on ethical conduct and conflict of interest

**Why This Matters:**
When clients and stakeholders trust your certification decisions, they trust your entire organization. This clause sets the ethical foundation for everything else in ISO 17021.

*Prepared by Sahih Certifications Quality Assurance Team*`,
  },
  {
    clause: "4.2",
    title: "Impartiality",
    shortTip: "Identify and manage threats to impartiality before they compromise decisions.",
    article: `**Understanding ISO 17021-1:2015 Clause 4.2 - Impartiality**

Impartiality is not just a principle—it's a continuous commitment that requires active management and vigilance.

**Key Requirements:**
- Identify threats to impartiality on an ongoing basis
- Analyze and document risks to impartiality
- Eliminate or minimize threats through appropriate safeguards
- Maintain a committee to safeguard impartiality

**Implementation Tips from Sahih Certifications:**
1. Conduct annual impartiality risk assessments
2. Maintain a register of potential conflicts of interest
3. Train all personnel on recognizing impartiality threats
4. Establish an independent Impartiality Committee with external representation

**Common Threats to Watch:**
- Self-interest (financial pressures)
- Self-review (auditing your own consultancy work)
- Familiarity (long-term relationships with clients)
- Intimidation (pressure from powerful clients)

*Prepared by Sahih Certifications Quality Assurance Team*`,
  },
  {
    clause: "5.1",
    title: "Legal & Contractual Matters",
    shortTip: "Your certification body must be a legally identifiable entity with proper authority.",
    article: `**Understanding ISO 17021-1:2015 Clause 5.1 - Legal & Contractual Matters**

A certification body must operate within a clear legal framework that defines its authority and responsibilities.

**Key Requirements:**
- Be a legal entity or defined part of a legal entity
- Have legally enforceable arrangements with clients
- Maintain responsibility for all certification decisions
- Clearly define the certification scope and conditions

**Implementation Tips from Sahih Certifications:**
1. Ensure your organization's legal status is clearly documented
2. Use standardized contracts that meet ISO 17021 requirements
3. Include clear terms for suspension, withdrawal, and scope changes
4. Maintain proper insurance and liability coverage

**Contract Essentials:**
- Rights and obligations of both parties
- Conditions for use of certification marks
- Surveillance and recertification requirements
- Handling of complaints and appeals

*Prepared by Sahih Certifications Quality Assurance Team*`,
  },
  {
    clause: "5.2",
    title: "Management of Impartiality",
    shortTip: "Top management must commit to impartiality—it's not just a policy, it's a culture.",
    article: `**Understanding ISO 17021-1:2015 Clause 5.2 - Management of Impartiality**

Leadership commitment to impartiality must be visible, documented, and actively demonstrated throughout the organization.

**Key Requirements:**
- Top management commitment to impartiality
- Public accessibility of impartiality statements
- Revenue sources that don't compromise objectivity
- Actions to respond to threats identified

**Implementation Tips from Sahih Certifications:**
1. Include impartiality in your quality policy and objectives
2. Review impartiality at management review meetings
3. Ensure no single client represents more than a threshold of revenue
4. Publish your impartiality commitment on your website

**Leadership Actions:**
- Set the tone from the top
- Allocate resources for impartiality management
- Recognize and reward ethical behavior
- Take swift action when threats are identified

*Prepared by Sahih Certifications Quality Assurance Team*`,
  },
  {
    clause: "6.1",
    title: "Organizational Structure",
    shortTip: "Clear organizational charts prevent role confusion and ensure accountability.",
    article: `**Understanding ISO 17021-1:2015 Clause 6.1 - Organizational Structure**

A well-defined organizational structure ensures clarity of roles, responsibilities, and reporting lines.

**Key Requirements:**
- Document the organizational structure
- Define responsibilities and authorities
- Identify personnel who make certification decisions
- Ensure competence at all levels

**Implementation Tips from Sahih Certifications:**
1. Create detailed organizational charts updated annually
2. Define job descriptions for all certification roles
3. Establish clear delegation of authority procedures
4. Ensure backup personnel for critical functions

**Structure Considerations:**
- Separation of audit and certification decision functions
- Independence of the certification decision-maker
- Clear escalation paths for complex decisions
- Defined interfaces between departments

*Prepared by Sahih Certifications Quality Assurance Team*`,
  },
  {
    clause: "7.1",
    title: "Competence of Personnel",
    shortTip: "Competent auditors are your most valuable asset—invest in their development.",
    article: `**Understanding ISO 17021-1:2015 Clause 7.1 - Competence of Personnel**

The quality of certification depends directly on the competence of the personnel involved in the process.

**Key Requirements:**
- Define competence criteria for each function
- Evaluate personnel against defined criteria
- Maintain records of competence evaluations
- Address competence gaps through training

**Implementation Tips from Sahih Certifications:**
1. Develop a competence matrix for all certification roles
2. Conduct initial and ongoing competence evaluations
3. Implement a witness audit program
4. Create individual development plans

**Competence Areas:**
- Technical knowledge of management systems
- Understanding of ISO 17021 requirements
- Audit skills and techniques
- Sector-specific knowledge

*Prepared by Sahih Certifications Quality Assurance Team*`,
  },
  {
    clause: "7.2",
    title: "Personnel Involved in Certification",
    shortTip: "Every person in the certification process needs defined competence criteria.",
    article: `**Understanding ISO 17021-1:2015 Clause 7.2 - Personnel Involved in Certification**

All personnel involved in certification activities must meet specific competence requirements appropriate to their role.

**Key Requirements:**
- Define competence for auditors, technical experts, and decision-makers
- Ensure knowledge of certification schemes operated
- Maintain records of initial and ongoing monitoring
- Conduct performance evaluations

**Implementation Tips from Sahih Certifications:**
1. Categorize personnel by certification function
2. Develop role-specific training programs
3. Implement peer reviews and feedback mechanisms
4. Track continuing professional development

**Personnel Categories:**
- Lead auditors and audit team members
- Technical experts and observers
- Certification decision-makers
- Administrative and support personnel

*Prepared by Sahih Certifications Quality Assurance Team*`,
  },
  {
    clause: "7.3",
    title: "Use of Auditors & Technical Experts",
    shortTip: "Match auditor expertise to client industry for meaningful assessments.",
    article: `**Understanding ISO 17021-1:2015 Clause 7.3 - Use of Auditors & Technical Experts**

Proper selection and assignment of audit teams ensures effective and credible certification audits.

**Key Requirements:**
- Select auditors with appropriate competence
- Assign technical experts when specialized knowledge is needed
- Communicate team composition to clients
- Address client objections appropriately

**Implementation Tips from Sahih Certifications:**
1. Maintain a database of auditor competencies by sector
2. Use technical experts for high-risk or specialized audits
3. Give clients reasonable opportunity to object to team composition
4. Document rationale for team selection decisions

**Team Composition Factors:**
- Industry sector experience
- Language capabilities
- Previous audit history with client
- Potential conflicts of interest

*Prepared by Sahih Certifications Quality Assurance Team*`,
  },
  {
    clause: "8.2",
    title: "Initial Audit",
    shortTip: "Stage 1 audits identify issues early—use them to set clients up for success.",
    article: `**Understanding ISO 17021-1:2015 Clause 8.2 - Initial Audit**

The initial certification audit is conducted in two stages to ensure thorough evaluation and client readiness.

**Key Requirements:**
- Stage 1: Evaluate documentation and readiness
- Stage 2: Evaluate implementation effectiveness
- Document findings from both stages
- Make certification decision based on complete evidence

**Implementation Tips from Sahih Certifications:**
1. Use Stage 1 to build understanding of the client's context
2. Identify potential problem areas before Stage 2
3. Verify internal audits and management review have been conducted
4. Allow appropriate time between stages for client preparation

**Stage 1 Focus Areas:**
- Policy and objectives documentation
- Internal audit program and results
- Management review records
- Legal and regulatory compliance status

*Prepared by Sahih Certifications Quality Assurance Team*`,
  },
  {
    clause: "8.3",
    title: "Surveillance Activities",
    shortTip: "Surveillance maintains certification integrity—it's not just a formality.",
    article: `**Understanding ISO 17021-1:2015 Clause 8.3 - Surveillance Activities**

Ongoing surveillance ensures that certified organizations maintain conformity throughout the certification cycle.

**Key Requirements:**
- Conduct surveillance at planned intervals
- Cover the full management system scope over the cycle
- Address nonconformities from previous audits
- Verify continued conformity and effectiveness

**Implementation Tips from Sahih Certifications:**
1. Plan surveillance to cover all management system elements
2. Focus on areas of change or previous concerns
3. Review client's handling of complaints
4. Verify corrective actions remain effective

**Surveillance Considerations:**
- Internal audits and management reviews
- Actions on nonconformities from previous audits
- Handling of complaints
- Use of certification marks and references

*Prepared by Sahih Certifications Quality Assurance Team*`,
  },
  {
    clause: "8.4",
    title: "Recertification",
    shortTip: "Recertification confirms continued conformity—review the full cycle performance.",
    article: `**Understanding ISO 17021-1:2015 Clause 8.4 - Recertification**

Recertification confirms the continued effectiveness of the management system as a whole over the certification cycle.

**Key Requirements:**
- Plan recertification to maintain certification continuity
- Evaluate full system effectiveness over the cycle
- Review changes since last recertification
- Consider past surveillance findings

**Implementation Tips from Sahih Certifications:**
1. Start recertification planning 6 months before expiry
2. Review performance trends across the certification cycle
3. Evaluate achievement of management system objectives
4. Consider if a Stage 1 is needed for significant changes

**Recertification Review:**
- Effectiveness of the management system as a whole
- Commitment to continual improvement
- Achievement of objectives
- Contribution to client's strategic objectives

*Prepared by Sahih Certifications Quality Assurance Team*`,
  },
  {
    clause: "9.1",
    title: "Certification Decision",
    shortTip: "Certification decisions must be made by competent personnel independent of the audit.",
    article: `**Understanding ISO 17021-1:2015 Clause 9.1 - Certification Decision**

The certification decision is the culmination of the audit process and must be made with appropriate rigor and independence.

**Key Requirements:**
- Decision-makers must not have participated in the audit
- Decisions based on review of audit findings and evidence
- Ensure all nonconformities are addressed
- Document the decision and rationale

**Implementation Tips from Sahih Certifications:**
1. Establish clear certification decision criteria
2. Maintain a qualified pool of decision-makers
3. Use checklists to ensure consistent decision review
4. Allow adequate time for thorough review

**Decision Considerations:**
- Adequacy of evidence for conformity
- Classification and significance of nonconformities
- Effectiveness of corrective actions
- Auditor recommendations and conclusions

*Prepared by Sahih Certifications Quality Assurance Team*`,
  },
  {
    clause: "9.4",
    title: "Suspending, Withdrawing Certification",
    shortTip: "Have clear criteria for when to suspend or withdraw—and communicate them to clients upfront.",
    article: `**Understanding ISO 17021-1:2015 Clause 9.4 - Suspending, Withdrawing Certification**

Certification bodies must have clear processes for suspending or withdrawing certification when warranted.

**Key Requirements:**
- Define conditions for suspension and withdrawal
- Suspend when there are serious failures or misuse of marks
- Limit suspension period to six months maximum
- Withdraw when issues are not resolved

**Implementation Tips from Sahih Certifications:**
1. Include suspension/withdrawal conditions in client contracts
2. Establish graduated response procedures
3. Communicate consequences clearly before taking action
4. Maintain records of all suspension/withdrawal decisions

**Triggers for Action:**
- Persistent failure to address nonconformities
- Misuse of certification marks or claims
- Failure to permit scheduled audits
- Voluntary request by client

*Prepared by Sahih Certifications Quality Assurance Team*`,
  },
  {
    clause: "9.6",
    title: "Complaints & Appeals",
    shortTip: "Handling complaints fairly builds trust—even when findings are upheld.",
    article: `**Understanding ISO 17021-1:2015 Clause 9.6 - Complaints & Appeals**

A fair and transparent process for handling complaints and appeals is essential for certification body credibility.

**Key Requirements:**
- Document and validate all complaints
- Investigate using personnel independent of the subject
- Provide opportunity for appeal of decisions
- Track and trend complaints for improvement

**Implementation Tips from Sahih Certifications:**
1. Acknowledge complaints within 48 hours
2. Set and communicate resolution timelines
3. Use complaints as improvement opportunities
4. Report complaint trends to management review

**Process Steps:**
- Receipt and acknowledgment
- Investigation by independent personnel
- Decision and communication
- Follow-up on corrective actions

*Prepared by Sahih Certifications Quality Assurance Team*`,
  },
  {
    clause: "9.7",
    title: "Records of Applicants & Clients",
    shortTip: "Good records are your defense during accreditation assessments—keep them complete.",
    article: `**Understanding ISO 17021-1:2015 Clause 9.7 - Records of Applicants & Clients**

Comprehensive records support certification decisions and demonstrate conformity to accreditation requirements.

**Key Requirements:**
- Maintain records for each client organization
- Include audit reports, certificates, and correspondence
- Ensure secure storage and accessibility
- Define retention periods

**Implementation Tips from Sahih Certifications:**
1. Use a document management system for consistency
2. Include all communication in client files
3. Regular backup and archive procedures
4. Ensure confidentiality while maintaining accessibility

**Essential Records:**
- Application and contract documents
- Audit plans and reports
- Nonconformity reports and corrective actions
- Certification decisions and certificates issued

*Prepared by Sahih Certifications Quality Assurance Team*`,
  },
  {
    clause: "10",
    title: "Management System Requirements",
    shortTip: "Your own management system must meet the same standards you certify others against.",
    article: `**Understanding ISO 17021-1:2015 Clause 10 - Management System Requirements**

Certification bodies must implement their own management system to ensure consistent operations and continual improvement.

**Key Requirements:**
- Implement a documented management system
- Include all ISO 17021 requirements
- Conduct internal audits and management reviews
- Pursue continual improvement

**Implementation Tips from Sahih Certifications:**
1. Align your system with ISO 9001 structure if helpful
2. Conduct thorough internal audits annually
3. Use management review to drive improvement
4. Set and monitor quality objectives

**System Elements:**
- Documented policies and procedures
- Internal audit program
- Management review process
- Continual improvement mechanism

*Prepared by Sahih Certifications Quality Assurance Team*`,
  },
];

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

const clauseQuizzes: Record<string, QuizQuestion[]> = {
  "4.1": [
    {
      question: "According to ISO 17021-1:2015 Clause 4.1, which principle forms the absolute foundation of certification body credibility?",
      options: ["Efficiency in operations", "Impartiality and objectivity", "Speed of certification decisions", "Client satisfaction ratings"],
      correctAnswer: 1,
      explanation: "Impartiality and objectivity are the foundational principles that ensure trust and reliability in certification processes."
    },
    {
      question: "What must certification decisions be based upon according to Clause 4.1?",
      options: ["Auditor subjective assessment", "Client payment status", "Objective evidence of conformity", "Industry reputation"],
      correctAnswer: 2,
      explanation: "Decisions must be based on objective evidence of conformity, not subjective factors or commercial considerations."
    },
    {
      question: "Which of the following is NOT a requirement under Clause 4.1 General Principles?",
      options: ["Consistency in certification process", "Transparency in operations", "Guaranteed certification within 30 days", "Fairness to all applicants"],
      correctAnswer: 2,
      explanation: "There is no requirement for guaranteed certification timelines. The focus is on consistency, fairness, and transparency."
    }
  ],
  "4.2": [
    {
      question: "Under Clause 4.2, threats to impartiality must be:",
      options: ["Reported annually to accreditation bodies", "Identified and managed on an ongoing basis", "Disclosed only if discovered by auditors", "Addressed only when clients complain"],
      correctAnswer: 1,
      explanation: "Threats to impartiality must be identified and managed continuously, not just periodically or reactively."
    },
    {
      question: "Which type of threat occurs when a CB audits work it previously consulted on?",
      options: ["Intimidation threat", "Advocacy threat", "Self-review threat", "Familiarity threat"],
      correctAnswer: 2,
      explanation: "Self-review threat occurs when auditing your own previous consultancy work, creating conflict of interest."
    },
    {
      question: "What governance body is required to safeguard impartiality under ISO 17021?",
      options: ["Technical committee", "Impartiality committee with external representation", "Internal audit team", "Client advisory board"],
      correctAnswer: 1,
      explanation: "An Impartiality Committee with external representation is required to oversee and safeguard impartiality."
    }
  ],
  "5.1": [
    {
      question: "What legal status must a certification body maintain under Clause 5.1?",
      options: ["Non-profit organization only", "Government entity only", "Legal entity or defined part of a legal entity", "Private limited company only"],
      correctAnswer: 2,
      explanation: "A CB must be a legal entity or a defined part of a legal entity to operate with proper authority."
    },
    {
      question: "Certification body arrangements with clients must be:",
      options: ["Verbal agreements", "Legally enforceable", "Flexible and informal", "Renewed monthly"],
      correctAnswer: 1,
      explanation: "Arrangements with clients must be legally enforceable to ensure proper rights and obligations."
    }
  ],
  "5.2": [
    {
      question: "Under Clause 5.2, who must demonstrate commitment to impartiality?",
      options: ["Only the auditors", "Only the quality manager", "Top management", "External consultants"],
      correctAnswer: 2,
      explanation: "Top management must demonstrate visible commitment to impartiality - it starts at the top."
    },
    {
      question: "What revenue-related consideration affects impartiality under Clause 5.2?",
      options: ["Total annual revenue must exceed $1 million", "Revenue sources must not compromise objectivity", "All clients must pay the same fees", "Government contracts are prohibited"],
      correctAnswer: 1,
      explanation: "Revenue sources must be structured so they don't compromise objectivity in certification decisions."
    }
  ],
  "6.1": [
    {
      question: "What must be clearly documented according to Clause 6.1?",
      options: ["Client satisfaction surveys", "Organizational structure with roles and responsibilities", "Annual financial statements", "Marketing strategies"],
      correctAnswer: 1,
      explanation: "The organizational structure including roles, responsibilities, and reporting lines must be documented."
    },
    {
      question: "Why is separation of audit and certification decision functions important?",
      options: ["To reduce workload", "To ensure independence and prevent conflicts", "To speed up the process", "To reduce training costs"],
      correctAnswer: 1,
      explanation: "Separation ensures independence and prevents the same person from conducting audits and making final decisions."
    }
  ],
  "7.1": [
    {
      question: "What is the PRIMARY requirement for personnel under Clause 7.1?",
      options: ["University degree in relevant field", "Defined and evaluated competence criteria", "Minimum 10 years industry experience", "Certification from international bodies"],
      correctAnswer: 1,
      explanation: "Personnel must meet defined competence criteria specific to their role, evaluated through formal assessment."
    },
    {
      question: "How should competence gaps be addressed according to ISO 17021?",
      options: ["Terminate employment immediately", "Through targeted training and development", "Reassign to non-critical roles only", "Request client waiver"],
      correctAnswer: 1,
      explanation: "Competence gaps should be addressed through appropriate training and development programs."
    }
  ],
  "7.2": [
    {
      question: "Which personnel categories require defined competence under Clause 7.2?",
      options: ["Only lead auditors", "Only technical experts", "Auditors, technical experts, and decision-makers", "Only administrative staff"],
      correctAnswer: 2,
      explanation: "All personnel involved in certification - auditors, technical experts, and decision-makers - need defined competence."
    }
  ],
  "7.3": [
    {
      question: "When should technical experts be assigned to audit teams?",
      options: ["Only when clients request them", "When specialized knowledge beyond auditor competence is needed", "For all ISO 9001 audits", "Only for initial certification audits"],
      correctAnswer: 1,
      explanation: "Technical experts are assigned when specialized knowledge beyond auditor competence is required."
    },
    {
      question: "Clients have the right to:",
      options: ["Select their preferred auditors", "Object to proposed audit team composition", "Cancel audits without notice", "Review auditor salaries"],
      correctAnswer: 1,
      explanation: "Clients have a reasonable right to object to team composition if they have valid concerns."
    }
  ],
  "8.2": [
    {
      question: "What is the primary purpose of a Stage 1 audit?",
      options: ["To issue the certificate", "To identify issues early and prepare for Stage 2", "To verify corrective actions", "To conduct surveillance"],
      correctAnswer: 1,
      explanation: "Stage 1 audits identify potential issues early and prepare the organization for a successful Stage 2 audit."
    }
  ],
  "9.1": [
    {
      question: "Who CANNOT make the certification decision under Clause 9.1?",
      options: ["Quality manager", "Technical reviewer", "Personnel who participated in the audit", "Certification committee member"],
      correctAnswer: 2,
      explanation: "Personnel who participated in the audit cannot make the certification decision - this ensures independence."
    },
    {
      question: "What must be documented regarding certification decisions?",
      options: ["Only the final decision", "The decision and its rationale", "Only rejected applications", "Only client complaints"],
      correctAnswer: 1,
      explanation: "Both the decision and the rationale supporting it must be documented for audit trail purposes."
    }
  ],
  "9.4": [
    {
      question: "What is the maximum period for suspension of certification under ISO 17021?",
      options: ["30 days", "90 days", "6 months", "12 months"],
      correctAnswer: 2,
      explanation: "Suspension is limited to a maximum of 6 months, after which withdrawal must be considered."
    },
    {
      question: "Which is a valid trigger for certification suspension?",
      options: ["Client requesting a different auditor", "Persistent failure to address nonconformities", "Late payment of fees by 5 days", "Change in client management"],
      correctAnswer: 1,
      explanation: "Persistent failure to address nonconformities is a serious trigger for suspension."
    }
  ],
  "9.6": [
    {
      question: "Who should investigate complaints about certification decisions?",
      options: ["The auditor who conducted the audit", "Personnel independent of the subject matter", "The client who made the complaint", "External legal counsel only"],
      correctAnswer: 1,
      explanation: "Complaints must be investigated by personnel independent of the subject to ensure objectivity."
    }
  ],
  "9.7": [
    {
      question: "What must client records include according to Clause 9.7?",
      options: ["Only certificate copies", "Audit reports, certificates, and all correspondence", "Only nonconformity reports", "Only financial transactions"],
      correctAnswer: 1,
      explanation: "Comprehensive records including audit reports, certificates, and all correspondence must be maintained."
    },
    {
      question: "Why are complete records critical for certification bodies?",
      options: ["For marketing purposes", "For tax compliance only", "As defense during accreditation assessments", "To track auditor performance only"],
      correctAnswer: 2,
      explanation: "Complete records are your defense during accreditation assessments and demonstrate conformity."
    }
  ],
  "10": [
    {
      question: "Under Clause 10, certification bodies must:",
      options: ["Only follow client management systems", "Implement their own documented management system", "Use the same system as their accreditation body", "Avoid internal audits to maintain objectivity"],
      correctAnswer: 1,
      explanation: "CBs must implement their own documented management system meeting ISO 17021 requirements."
    },
    {
      question: "What is the purpose of management review in a CB's own management system?",
      options: ["To approve client certifications", "To drive continual improvement", "To reduce audit frequency", "To select new clients"],
      correctAnswer: 1,
      explanation: "Management review is a key mechanism for driving continual improvement in the CB's operations."
    }
  ]
};

const getTimeGreeting = (): { greeting: string; icon: JSX.Element; period: string } => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return { greeting: "Good Morning", icon: <Sun className="w-6 h-6 text-amber-500" />, period: "morning" };
  } else if (hour >= 12 && hour < 17) {
    return { greeting: "Good Afternoon", icon: <CloudSun className="w-6 h-6 text-orange-500" />, period: "afternoon" };
  } else if (hour >= 17 && hour < 21) {
    return { greeting: "Good Evening", icon: <CloudSun className="w-6 h-6 text-orange-400" />, period: "evening" };
  } else {
    return { greeting: "Good Night", icon: <Moon className="w-6 h-6 text-amber-300" />, period: "night" };
  }
};

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading, isError: statsError } = useDashboardStats();
  const { data: alerts, isLoading: alertsLoading } = useComplianceAlerts();
  const { data: activity, isLoading: activityLoading } = useRecentActivity();
  const { data: myTasks, isLoading: tasksLoading } = useMyTasks();
  const { data: allUsers } = useUsers();
  const { data: currentUser } = useAuth();
  const { data: activeUsers } = useActiveUsers();
  const heartbeatMutation = useActivityHeartbeat();
  
  // Send activity heartbeat every 5 minutes
  useEffect(() => {
    const sendHeartbeat = () => {
      heartbeatMutation.mutate();
    };
    
    // Send initial heartbeat
    sendHeartbeat();
    
    // Set up interval for periodic heartbeats
    const interval = setInterval(sendHeartbeat, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  const isManager = currentUser?.role === 'admin' || currentUser?.role === 'quality_manager' || currentUser?.role === 'department_head';
  const { data: allDocumentTasks } = useAllDocumentTasks(isManager);
  const completeTaskMutation = useCompleteTask();
  const pokeMutation = usePokeTask();
  const { toast } = useToast();
  
  // Download and access approval mutations
  const approveDownloadMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest('POST', `/api/download-requests/${requestId}/approve`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/download-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });
  
  const rejectDownloadMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest('POST', `/api/download-requests/${requestId}/reject`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/download-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });
  
  const approveAccessMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest('POST', `/api/document-access-requests/${requestId}/approve`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/document-access-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/document-access'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });
  
  const rejectAccessMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest('POST', `/api/document-access-requests/${requestId}/reject`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/document-access-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });
  
  // Employee approval mutations
  const approveEmployeeMutation = useApproveEmployee();
  const rejectEmployeeMutation = useRejectEmployee();
  const submitEmployeeForApprovalMutation = useSubmitEmployeeForApproval();

  const [selectedTask, setSelectedTask] = useState<MyTask | null>(null);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [taskComments, setTaskComments] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [pokeMessage, setPokeMessage] = useState("");
  const [pokeTaskId, setPokeTaskId] = useState<number | null>(null);
  const [showPokeDialog, setShowPokeDialog] = useState(false);
  const [showComplianceDialog, setShowComplianceDialog] = useState(false);
  const [showTasksFocusDialog, setShowTasksFocusDialog] = useState(false);
  const [showIsoTipDialog, setShowIsoTipDialog] = useState(false);
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>([]);
  const [quizComplete, setQuizComplete] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [location, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedApproverId, setSelectedApproverId] = useState<string>("");

  // Get CEO user for default approver
  const ceoUser = useMemo(() => allUsers?.find(u => u.email === 'ceo@sahihcertify.com'), [allUsers]);

  // Auto-fill approver when CEO user becomes available (handles async loading)
  useEffect(() => {
    if (selectedTask?.taskType === 'employee_review' && ceoUser && !selectedApproverId) {
      setSelectedApproverId(String(ceoUser.id));
    }
  }, [selectedTask, ceoUser, selectedApproverId]);

  const dailyIsoTip = useMemo(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return iso17021Clauses[dayOfYear % iso17021Clauses.length];
  }, []);

  const handlePoke = async () => {
    if (!pokeTaskId) return;
    try {
      await pokeMutation.mutateAsync({ taskId: pokeTaskId, message: pokeMessage });
      toast({ title: "Reminder sent", description: "A notification has been sent to the assignee." });
      setShowPokeDialog(false);
      setPokeMessage("");
      setPokeTaskId(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const dailyQuote = useMemo(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return motivationalQuotes[dayOfYear % motivationalQuotes.length];
  }, []);

  const timeInfo = useMemo(() => getTimeGreeting(), [currentTime]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const complianceScore = useMemo(() => {
    if (!stats?.totalDocuments) return 0;
    return Math.round(((stats.approvedDocuments || 0) / stats.totalDocuments) * 100);
  }, [stats]);

  const gradientId = useId();
  
  const tickerItems = useMemo(() => {
    if (!activity?.length) return [];
    return [...activity, ...activity];
  }, [activity]);

  const getTaskIcon = (taskType: string) => {
    switch (taskType) {
      case 'prepare':
        return <FilePen className="w-4 h-4 text-primary" />;
      case 'review':
        return <FileCheck className="w-4 h-4 text-amber-600" />;
      case 'approve':
        return <FileSignature className="w-4 h-4 text-success" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getTaskBadgeColor = (taskType: string) => {
    switch (taskType) {
      case 'prepare':
        return 'bg-primary/10 text-primary';
      case 'review':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'approve':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      default:
        return '';
    }
  };

  const handleOpenTask = (task: MyTask) => {
    setSelectedTask(task);
    setTaskComments("");
    // Default approver to CEO for employee review tasks
    if (task.taskType === 'employee_review' && ceoUser) {
      setSelectedApproverId(String(ceoUser.id));
    } else {
      setSelectedApproverId("");
    }
    setShowTaskDialog(true);
  };

  const handleCompleteTask = async () => {
    if (!selectedTask || !selectedTask.documentId) return;
    
    try {
      await completeTaskMutation.mutateAsync({
        documentId: selectedTask.documentId,
        taskType: selectedTask.taskType as 'prepare' | 'review' | 'approve',
        comments: taskComments || undefined,
      });
      
      toast({
        title: "Task Completed",
        description: `Successfully completed ${selectedTask.taskType} task for ${selectedTask.documentCode}`,
      });
      
      setShowTaskDialog(false);
      setSelectedTask(null);
      setTaskComments("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to complete task",
        variant: "destructive",
      });
    }
  };

  if (statsError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <h2 className="text-lg font-semibold" data-testid="text-error-title">Failed to load dashboard</h2>
        <p className="text-muted-foreground" data-testid="text-error-message">Please try refreshing the page</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8 overflow-x-hidden">
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(139, 0, 0, 0.1); }
          50% { box-shadow: 0 0 40px rgba(139, 0, 0, 0.2); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes countUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .glass-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.18);
        }
        .stat-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .stat-card:hover {
          transform: translateY(-4px);
        }
        .progress-ring {
          transition: stroke-dashoffset 1s ease-in-out;
        }
        .ticker-scroll {
          animation: ticker 60s linear infinite;
        }
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .stat-card:hover { transform: none; }
          .glass-card { animation: none !important; }
          .ticker-scroll { animation: none; }
          .progress-ring { transition: none; }
          .animate-pulse, .animate-ping { animation: none; }
        }
      `}</style>

      {/* Combined Hero + ISO 17021 Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hero Section with Dynamic Greeting */}
        <div 
          className="relative overflow-hidden rounded-2xl p-4 sm:p-6 shadow-xl gradient-primary"
          data-testid="hero-section"
        >
          <div className="absolute inset-0">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-soft rounded-full blur-3xl opacity-25 -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent-soft rounded-full blur-3xl opacity-30 translate-y-1/2 -translate-x-1/2"></div>
          </div>
          
          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {timeInfo.icon}
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white drop-shadow-lg truncate" data-testid="text-greeting">
                    {timeInfo.greeting}!
                  </h1>
                  <p className="text-white/80 text-[10px] sm:text-xs font-medium truncate">
                    {format(currentTime, "EEE, MMM d")} • {format(currentTime, "h:mm a")}
                  </p>
                </div>
              </div>
              
              <div data-testid="hub-eebi-avatar" className="flex-shrink-0">
                <HubEebiFullBody />
              </div>
            </div>
            
            <div className="min-w-0">
              <p className="text-white italic text-xs sm:text-sm drop-shadow-md line-clamp-2" data-testid="text-quote">
                "{dailyQuote.quote}"
              </p>
              <p className="text-white/70 text-[10px] sm:text-xs mt-1 font-medium">— Sahih-Hub</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div 
                className="rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 flex items-center gap-2 border border-white/20 shadow-lg gradient-primary-soft backdrop-blur-sm cursor-pointer hover:bg-white/10 transition-all flex-1 min-w-[120px]"
                onClick={() => setShowTasksFocusDialog(true)}
              >
                <div className="p-1 sm:p-1.5 rounded-md bg-white/20">
                  <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-white/70 text-[9px] sm:text-[10px] font-medium">Today's Focus</p>
                  <p className="text-white font-semibold text-[10px] sm:text-xs truncate" data-testid="text-focus">
                    {(myTasks?.length || 0) > 0 ? `${myTasks?.length} Tasks` : 'All Clear!'}
                  </p>
                </div>
              </div>
              
              <div 
                className="rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 flex items-center gap-2 border border-white/20 shadow-lg gradient-primary-soft backdrop-blur-sm cursor-pointer hover:bg-white/10 transition-all flex-1 min-w-[120px]"
                onClick={() => setShowComplianceDialog(true)}
              >
                <div className="p-1 sm:p-1.5 rounded-md bg-white/20">
                  <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-white/70 text-[9px] sm:text-[10px] font-medium">Compliance</p>
                  <p className="text-white font-semibold text-[10px] sm:text-xs" data-testid="text-score">{complianceScore}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ISO 17021 Daily Tip Card */}
        <Card 
          className="overflow-hidden cursor-pointer hover:shadow-lg transition-all group border-2 border-amber-200/50 dark:border-amber-800/50 flex flex-col"
          onClick={() => setShowIsoTipDialog(true)}
          data-testid="card-iso-tip"
        >
          <div className="p-3 sm:p-4 bg-gradient-to-r from-amber-500 to-amber-600 flex items-center gap-3">
            <GraduationCap className="w-8 h-8 sm:w-10 sm:h-10 text-white flex-shrink-0" />
            <div>
              <p className="text-white font-bold text-sm sm:text-base">ISO 17021 Daily Insight</p>
              <p className="text-white/80 text-[10px] sm:text-xs">Clause {dailyIsoTip.clause}: {dailyIsoTip.title}</p>
            </div>
          </div>
          <div className="flex-1 p-3 sm:p-4 bg-gradient-to-r from-amber-50 to-white dark:from-amber-950/30 dark:to-card">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-foreground text-xs sm:text-sm font-medium line-clamp-3">{dailyIsoTip.shortTip}</p>
            </div>
            <div className="flex items-center justify-between mt-3">
              <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                Click to read full article
              </p>
              <div className="flex items-center gap-1 text-amber-600 group-hover:translate-x-1 transition-transform">
                <span className="text-xs font-medium hidden sm:inline">Read More</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex" data-testid="tabs-dashboard-nav">
          <TabsTrigger 
            value="dashboard" 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2"
            data-testid="tab-dashboard"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger 
            value="compliance" 
            onClick={() => document.getElementById('compliance-section')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex items-center gap-2"
            data-testid="tab-compliance"
          >
            <Activity className="w-4 h-4" />
            <span className="hidden sm:inline">Compliance</span>
          </TabsTrigger>
          <TabsTrigger 
            value="documents" 
            onClick={() => navigate("/documents")}
            className="flex items-center gap-2"
            data-testid="tab-new-document"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Documents</span>
          </TabsTrigger>
          <TabsTrigger 
            value="users" 
            onClick={() => navigate("/users")}
            className="flex items-center gap-2"
            data-testid="tab-manage-users"
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Users</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* My Tasks Section - Primary Focus for Individual Performance */}
      <Card data-testid="card-my-tasks" className="overflow-hidden shadow-lg border-2 border-primary/20">
        <div className="px-6 py-4 gradient-primary">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-white/10 border border-white/20">
                <ClipboardList className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">My Tasks</h2>
                <p className="text-white/70 text-sm">Documents assigned to you for action</p>
              </div>
            </div>
          </div>
        </div>
        <CardContent className="p-6 bg-gradient-to-b from-primary/5 to-background">
          <div className="space-y-3">
            {tasksLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 rounded-xl border-2 border-primary/20 bg-white dark:bg-card">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 flex-1">
                      <Skeleton className="h-12 w-12 rounded-xl" />
                      <div className="flex-1">
                        <Skeleton className="h-5 w-32 mb-2" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                    </div>
                    <Skeleton className="h-10 w-24" />
                  </div>
                </div>
              ))
            ) : myTasks && myTasks.length > 0 ? (
              myTasks.map((task, idx) => (
                <div 
                  key={`${task.documentId}-${task.taskType}`} 
                  className="p-4 rounded-xl border-2 border-primary/20 hover:border-primary hover:shadow-xl cursor-pointer transition-all group bg-white dark:bg-card"
                  style={{ animation: `slideIn 0.3s ease-out ${idx * 0.1}s backwards` }}
                  onClick={() => handleOpenTask(task)}
                  data-testid={`task-${task.documentId}-${task.taskType}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/20 group-hover:from-primary/20 group-hover:to-primary/30 transition-all">
                        {getTaskIcon(task.taskType)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-lg" data-testid={`text-task-code-${task.documentId}`}>{task.documentCode}</p>
                          <Badge className={`${getTaskBadgeColor(task.taskType)} font-semibold`} data-testid={`badge-task-type-${task.documentId}`}>
                            {task.taskType.charAt(0).toUpperCase() + task.taskType.slice(1)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground" data-testid={`text-task-title-${task.documentId}`}>{task.title}</p>
                      </div>
                    </div>
                    <Button 
                      size="default" 
                      className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md group-hover:shadow-lg transition-all" 
                      data-testid={`button-open-task-${task.documentId}`}
                    >
                      Open Task
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12" data-testid="text-no-tasks">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-950/20 mx-auto mb-4 flex items-center justify-center shadow-lg">
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                </div>
                <p className="font-bold text-xl text-green-700 dark:text-green-400">All Caught Up!</p>
                <p className="text-muted-foreground mt-1">No pending tasks. Great work!</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Workflow Monitor for Managers - Shows all pending tasks with poke capability */}
      {isManager && allDocumentTasks && allDocumentTasks.length > 0 && (
        <Card data-testid="card-workflow-monitor">
          <CardHeader className="gradient-primary text-white rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm">
                  <Eye className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg">Workflow Monitor</CardTitle>
                  <CardDescription className="text-white/70">Track and remind assignees about pending tasks</CardDescription>
                </div>
              </div>
              <Badge className="bg-white/20 text-white border-white/30" variant="outline">
                {allDocumentTasks.length} pending
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {allDocumentTasks.slice(0, 5).map((task) => (
                <div 
                  key={task.id}
                  className={`p-4 rounded-lg border transition-all ${
                    (task.currentDelayHours || 0) > 0 
                      ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' 
                      : 'bg-card hover:bg-muted/50'
                  }`}
                  data-testid={`monitor-task-${task.id}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        {getTaskIcon(task.taskType)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{task.taskNumber}</span>
                          <Badge className={getTaskBadgeColor(task.taskType)}>
                            {task.taskType.charAt(0).toUpperCase() + task.taskType.slice(1)}
                          </Badge>
                          {(task.currentDelayHours || 0) > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {task.currentDelayHours}h overdue
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium mt-1">{task.documentTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          Assigned to: <span className="font-medium">{task.assignedToName || 'Unknown'}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPokeTaskId(task.id);
                          setShowPokeDialog(true);
                        }}
                        className="gap-1"
                        data-testid={`button-poke-${task.id}`}
                      >
                        <Bell className="h-4 w-4" />
                        Remind
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <Link href={`/documents/${task.documentId}/edit`} data-testid={`link-view-task-${task.id}`}>
                          View
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {allDocumentTasks.length > 5 && (
                <div className="text-center pt-2">
                  <Button variant="outline" asChild>
                    <Link href="/tasks">
                      View all {allDocumentTasks.length} tasks
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Poke/Remind Dialog */}
      <Dialog open={showPokeDialog} onOpenChange={setShowPokeDialog}>
        <DialogContent data-testid="dialog-poke">
          <DialogHeader>
            <DialogTitle>Send Reminder</DialogTitle>
            <DialogDescription>
              Send a notification to remind the assignee about their pending task.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="poke-message">Message (optional)</Label>
              <Textarea
                id="poke-message"
                placeholder="Add a message to your reminder..."
                value={pokeMessage}
                onChange={(e) => setPokeMessage(e.target.value)}
                className="mt-1.5"
                data-testid="input-poke-message"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPokeDialog(false)}>Cancel</Button>
            <Button 
              onClick={handlePoke} 
              disabled={pokeMutation.isPending}
              className="gap-1"
              data-testid="button-send-reminder"
            >
              <Bell className="h-4 w-4" />
              {pokeMutation.isPending ? "Sending..." : "Send Reminder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ISO 17021 Daily Tip Dialog */}
      <Dialog open={showIsoTipDialog} onOpenChange={(open) => {
        setShowIsoTipDialog(open);
        if (!open) {
          setQuizStarted(false);
          setCurrentQuizIndex(0);
          setSelectedAnswer(null);
          setQuizAnswers([]);
          setQuizComplete(false);
          setShowExplanation(false);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="dialog-iso-tip">
          <DialogHeader className="bg-gradient-to-r from-amber-500 to-amber-600 -mx-6 -mt-6 px-6 py-5 rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/20">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-xl">Get Your Daily Standard Doze</DialogTitle>
                <DialogDescription className="text-white/80">
                  Clause {dailyIsoTip.clause} - {dailyIsoTip.title}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">Today's Quick Tip</p>
                  <p className="text-foreground">{dailyIsoTip.shortTip}</p>
                </div>
              </div>
            </div>
            
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {dailyIsoTip.article.split('\n\n').map((paragraph, idx) => {
                if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                  return (
                    <h3 key={idx} className="text-lg font-bold text-foreground mt-4 mb-2">
                      {paragraph.replace(/\*\*/g, '')}
                    </h3>
                  );
                }
                if (paragraph.startsWith('**')) {
                  const parts = paragraph.split('**');
                  return (
                    <div key={idx} className="mb-3">
                      <h4 className="font-semibold text-foreground">{parts[1]}</h4>
                      <p className="text-muted-foreground">{parts[2]}</p>
                    </div>
                  );
                }
                if (paragraph.startsWith('- ')) {
                  return (
                    <ul key={idx} className="list-disc list-inside text-muted-foreground space-y-1">
                      {paragraph.split('\n').map((item, i) => (
                        <li key={i}>{item.replace('- ', '')}</li>
                      ))}
                    </ul>
                  );
                }
                if (paragraph.match(/^\d\./)) {
                  return (
                    <ol key={idx} className="list-decimal list-inside text-muted-foreground space-y-1">
                      {paragraph.split('\n').map((item, i) => (
                        <li key={i}>{item.replace(/^\d+\.\s*/, '')}</li>
                      ))}
                    </ol>
                  );
                }
                if (paragraph.startsWith('*') && paragraph.endsWith('*')) {
                  return (
                    <p key={idx} className="text-sm italic text-amber-700 dark:text-amber-400 mt-4 border-t pt-4">
                      {paragraph.replace(/\*/g, '')}
                    </p>
                  );
                }
                return (
                  <p key={idx} className="text-muted-foreground">
                    {paragraph}
                  </p>
                );
              })}
            </div>
            
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-lg p-4 mt-4">
              <div className="flex items-center gap-3">
                <img 
                  src="/attached_assets/download_(6)_1768389224478.png" 
                  alt="Sahih Certifications" 
                  className="h-12 w-12 rounded-lg object-cover"
                />
                <div>
                  <p className="font-bold text-primary">Sahih Certifications</p>
                  <p className="text-xs text-muted-foreground">Quality Assurance & Compliance Excellence</p>
                  <p className="text-xs text-muted-foreground">Doha, Qatar</p>
                </div>
              </div>
            </div>

            {/* Quiz Section */}
            {clauseQuizzes[dailyIsoTip.clause] && (
              <div className="mt-6 border-t pt-6">
                <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 rounded-lg p-4 border border-red-200 dark:border-red-800 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <h3 className="font-bold text-red-800 dark:text-red-300">Challenge Quiz</h3>
                  </div>
                  <p className="text-sm text-red-700 dark:text-red-400">
                    Test your understanding with tough questions. Your score will be added to your performance evaluation!
                  </p>
                </div>

                {!quizStarted && !quizComplete && (
                  <div className="text-center py-4">
                    <Button 
                      onClick={() => {
                        setQuizStarted(true);
                        setCurrentQuizIndex(0);
                        setQuizAnswers([]);
                        setSelectedAnswer(null);
                      }}
                      className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
                      data-testid="button-start-quiz"
                    >
                      <GraduationCap className="w-4 h-4 mr-2" />
                      Start Quiz ({clauseQuizzes[dailyIsoTip.clause].length} Questions)
                    </Button>
                  </div>
                )}

                {quizStarted && !quizComplete && (() => {
                  const questions = clauseQuizzes[dailyIsoTip.clause];
                  const currentQuestion = questions[currentQuizIndex];
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="font-mono">
                          Question {currentQuizIndex + 1} of {questions.length}
                        </Badge>
                        <Progress value={((currentQuizIndex) / questions.length) * 100} className="w-32 h-2" />
                      </div>
                      
                      <p className="font-semibold text-foreground">{currentQuestion.question}</p>
                      
                      <div className="space-y-2">
                        {currentQuestion.options.map((option, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              if (!showExplanation) {
                                setSelectedAnswer(idx);
                              }
                            }}
                            disabled={showExplanation}
                            className={`w-full p-3 rounded-lg border text-left transition-all ${
                              showExplanation
                                ? idx === currentQuestion.correctAnswer
                                  ? 'bg-green-100 border-green-500 dark:bg-green-900/30'
                                  : selectedAnswer === idx
                                  ? 'bg-red-100 border-red-500 dark:bg-red-900/30'
                                  : 'bg-muted/30 border-muted'
                                : selectedAnswer === idx
                                ? 'bg-primary/10 border-primary'
                                : 'bg-card hover:bg-muted/50 border-border'
                            }`}
                            data-testid={`quiz-option-${idx}`}
                          >
                            <span className="font-mono text-sm mr-2">{String.fromCharCode(65 + idx)}.</span>
                            {option}
                            {showExplanation && idx === currentQuestion.correctAnswer && (
                              <CheckCircle2 className="w-4 h-4 text-green-600 inline ml-2" />
                            )}
                            {showExplanation && selectedAnswer === idx && idx !== currentQuestion.correctAnswer && (
                              <X className="w-4 h-4 text-red-600 inline ml-2" />
                            )}
                          </button>
                        ))}
                      </div>

                      {showExplanation && (
                        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                          <p className="font-semibold text-blue-800 dark:text-blue-300 text-sm mb-1">Explanation:</p>
                          <p className="text-sm text-blue-700 dark:text-blue-400">{currentQuestion.explanation}</p>
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-2">
                        {!showExplanation ? (
                          <Button
                            onClick={() => {
                              if (selectedAnswer !== null) {
                                setShowExplanation(true);
                                setQuizAnswers([...quizAnswers, selectedAnswer]);
                              }
                            }}
                            disabled={selectedAnswer === null}
                            data-testid="button-submit-answer"
                          >
                            Submit Answer
                          </Button>
                        ) : (
                          <Button
                            onClick={() => {
                              if (currentQuizIndex < questions.length - 1) {
                                setCurrentQuizIndex(currentQuizIndex + 1);
                                setSelectedAnswer(null);
                                setShowExplanation(false);
                              } else {
                                setQuizComplete(true);
                              }
                            }}
                            data-testid="button-next-question"
                          >
                            {currentQuizIndex < questions.length - 1 ? 'Next Question' : 'View Results'}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {quizComplete && (() => {
                  const questions = clauseQuizzes[dailyIsoTip.clause];
                  const correctCount = quizAnswers.reduce((acc: number, answer, idx) => {
                    return acc + (answer === questions[idx].correctAnswer ? 1 : 0);
                  }, 0 as number);
                  const percentage = Math.round((correctCount / questions.length) * 100);
                  
                  return (
                    <div className="text-center py-6 space-y-4">
                      <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center ${
                        percentage >= 80 ? 'bg-green-100 dark:bg-green-900/30' : 
                        percentage >= 60 ? 'bg-yellow-100 dark:bg-yellow-900/30' : 
                        'bg-red-100 dark:bg-red-900/30'
                      }`}>
                        <span className={`text-3xl font-bold ${
                          percentage >= 80 ? 'text-green-600' : 
                          percentage >= 60 ? 'text-yellow-600' : 
                          'text-red-600'
                        }`}>
                          {percentage}%
                        </span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">
                          {percentage >= 80 ? 'Excellent!' : percentage >= 60 ? 'Good Effort!' : 'Keep Learning!'}
                        </h3>
                        <p className="text-muted-foreground">
                          You scored {correctCount} out of {questions.length} questions correctly.
                        </p>
                      </div>
                      <div className="bg-primary/10 rounded-lg p-4 mt-4">
                        <p className="text-sm font-medium text-primary">
                          This score has been recorded and will contribute to your performance evaluation.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setQuizStarted(false);
                          setQuizComplete(false);
                          setCurrentQuizIndex(0);
                          setSelectedAnswer(null);
                          setQuizAnswers([]);
                          setShowExplanation(false);
                        }}
                        data-testid="button-retake-quiz"
                      >
                        Retake Quiz
                      </Button>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
          <DialogFooter className="border-t pt-4">
            <p className="text-xs text-muted-foreground flex-1">
              New insights daily - Check back tomorrow for more ISO 17021 awareness content
            </p>
            <Button onClick={() => setShowIsoTipDialog(false)} data-testid="button-close-iso-tip">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modern Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card 
          data-testid="card-total-documents"
          className="stat-card cursor-pointer overflow-hidden relative group"
          onClick={() => navigate("/documents")}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <TrendingUp className="h-4 w-4 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            {statsLoading ? (
              <>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-24" />
              </>
            ) : (
              <>
                <div className="text-3xl font-bold" data-testid="text-total-documents" style={{ animation: 'countUp 0.5s ease-out' }}>
                  {stats?.totalDocuments || 0}
                </div>
                <p className="text-sm text-muted-foreground">Total Documents</p>
                <div className="mt-2 flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs">{stats?.approvedDocuments || 0} approved</Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card 
          data-testid="card-pending-approvals"
          className="stat-card cursor-pointer overflow-hidden relative group"
          onClick={() => navigate("/documents")}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              {(stats?.pendingApprovals || 0) > 0 && (
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              )}
            </div>
            {statsLoading ? (
              <>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-24" />
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-amber-600" data-testid="text-pending-approvals" style={{ animation: 'countUp 0.5s ease-out 0.1s backwards' }}>
                  {stats?.pendingApprovals || 0}
                </div>
                <p className="text-sm text-muted-foreground">Pending Approvals</p>
                <div className="mt-2">
                  <Badge variant="outline" className="text-xs border-amber-200 text-amber-700">Awaiting review</Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card 
          data-testid="card-expiring-soon"
          className="stat-card cursor-pointer overflow-hidden relative group"
          onClick={() => document.getElementById('compliance-section')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            {statsLoading ? (
              <>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-24" />
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-yellow-600" data-testid="text-expiring-documents" style={{ animation: 'countUp 0.5s ease-out 0.2s backwards' }}>
                  {stats?.expiringDocuments || 0}
                </div>
                <p className="text-sm text-muted-foreground">Expiring Soon</p>
                <div className="mt-2">
                  <Badge variant="outline" className="text-xs border-yellow-200 text-yellow-700">Within 30 days</Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card 
          data-testid="card-non-compliant"
          className="stat-card cursor-pointer overflow-hidden relative group"
          onClick={() => document.getElementById('compliance-section')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-red-100 dark:bg-red-900/30">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              {(stats?.nonCompliantDocuments || 0) > 0 && (
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              )}
            </div>
            {statsLoading ? (
              <>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-24" />
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-red-600" data-testid="text-non-compliant" style={{ animation: 'countUp 0.5s ease-out 0.3s backwards' }}>
                  {stats?.nonCompliantDocuments || 0}
                </div>
                <p className="text-sm text-muted-foreground">Non-Compliant</p>
                <div className="mt-2">
                  <Badge variant="outline" className="text-xs border-red-200 text-red-700">Overdue review</Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Compliance Health & Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Compliance Score Ring */}
        <Card className="lg:col-span-1" data-testid="card-compliance-ring">
          <CardContent className="p-6 flex flex-col items-center justify-center">
            <div className="relative w-40 h-40">
              <svg className="w-40 h-40 transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="none"
                  className="text-muted/20"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke={`url(#${gradientId})`}
                  strokeWidth="12"
                  fill="none"
                  strokeLinecap="round"
                  className="progress-ring"
                  strokeDasharray={`${2 * Math.PI * 70}`}
                  strokeDashoffset={`${2 * Math.PI * 70 * (1 - complianceScore / 100)}`}
                />
                <defs>
                  <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="hsl(var(--primary))" />
                    <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="hsl(var(--accent-muted))" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold" data-testid="text-compliance-ring-value">{complianceScore}%</span>
                <span className="text-sm text-muted-foreground">Compliant</span>
              </div>
            </div>
            <div className="mt-4 text-center">
              <h3 className="font-semibold">Compliance Health</h3>
              <p className="text-sm text-muted-foreground">
                {complianceScore >= 90 ? "Excellent" : complianceScore >= 70 ? "Good" : complianceScore >= 50 ? "Needs Improvement" : "Critical"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats Cards */}
        <Card className="lg:col-span-2" data-testid="card-quick-stats">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Quick Insights
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                <RefreshCw className="w-3 h-3 mr-1" />
                Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div 
                className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 cursor-pointer hover-elevate transition-all border border-primary/20"
                onClick={() => navigate("/users")}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Active Users</span>
                </div>
                <p className="text-2xl font-bold text-primary" data-testid="text-total-users">{stats?.totalUsers || 0}</p>
                <p className="text-xs text-muted-foreground">{stats?.pendingInductions || 0} pending induction</p>
              </div>
              
              <div 
                className="p-4 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-950/20 cursor-pointer hover-elevate transition-all border border-emerald-200 dark:border-emerald-800"
                onClick={() => navigate("/documents")}
              >
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-medium">Approved</span>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{stats?.approvedDocuments || 0}</p>
                <p className="text-xs text-muted-foreground">Documents approved</p>
              </div>
              
              <div 
                className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 cursor-pointer hover-elevate transition-all border border-primary/20"
                onClick={() => navigate("/documents")}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Success Rate</span>
                </div>
                <p className="text-2xl font-bold text-primary">{complianceScore}%</p>
                <p className="text-xs text-muted-foreground">Document approval rate</p>
              </div>
              
              <div 
                className="p-4 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-950/20 cursor-pointer hover-elevate transition-all border border-amber-200 dark:border-amber-800"
                onClick={() => navigate("/tasks")}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium">Active Tasks</span>
                </div>
                <p className="text-2xl font-bold text-amber-600">{myTasks?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Pending your action</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Activity Ticker */}
      {tickerItems.length > 0 && (
        <div className="relative overflow-hidden rounded-xl bg-muted/30 border" data-testid="activity-ticker">
          <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/50">
            <Activity className="w-4 h-4 text-primary animate-pulse" />
            <span className="text-sm font-medium">Live Activity Feed</span>
          </div>
          <div className="relative h-10 overflow-hidden">
            <div className="ticker-scroll flex items-center gap-8 absolute whitespace-nowrap py-2 px-4">
              {tickerItems.map((log, idx) => (
                <span key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  <span className="font-semibold text-foreground">{log.userName || 'System'}</span>
                  <span className="font-medium">{log.action.replace('_', ' ')}</span>
                  <span>
                    on {log.entityType === 'document' && log.documentTitle 
                      ? `document "${log.documentTitle}"` 
                      : log.entityType}
                  </span>
                  <span className="text-xs opacity-70">
                    {log.createdAt ? format(new Date(log.createdAt), 'h:mm a') : ''}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div id="compliance-section" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Alerts */}
        <Card data-testid="card-compliance-alerts">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <CardTitle>Compliance Alerts</CardTitle>
                  <CardDescription>Documents requiring attention</CardDescription>
                </div>
              </div>
              <Link href="/documents">
                <Button variant="ghost" size="sm" data-testid="link-view-all-documents">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alertsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-3 rounded-lg border">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <Skeleton className="h-4 w-4" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-20 mb-1" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </div>
                      <Skeleton className="h-5 w-20" />
                    </div>
                  </div>
                ))
              ) : alerts && alerts.length > 0 ? (
                alerts.slice(0, 5).map((alert, idx) => (
                  <div 
                    key={alert.id} 
                    className={`p-3 rounded-lg border transition-all hover:scale-[1.02] cursor-pointer ${
                      alert.alertLevel === 'red' 
                        ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900/50' 
                        : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900/50'
                    }`}
                    style={{ animation: `slideIn 0.3s ease-out ${idx * 0.1}s backwards` }}
                    onClick={() => navigate(`/documents/${alert.id}/view`)}
                    data-testid={`alert-${alert.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {alert.alertLevel === 'red' ? (
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        )}
                        <div>
                          <p className="font-medium text-sm" data-testid={`text-alert-code-${alert.id}`}>{alert.documentCode}</p>
                          <p className="text-xs text-muted-foreground" data-testid={`text-alert-title-${alert.id}`}>{alert.title}</p>
                        </div>
                      </div>
                      <Badge 
                        variant={alert.alertLevel === 'red' ? 'destructive' : 'secondary'}
                        data-testid={`badge-alert-${alert.id}`}
                      >
                        {alert.daysUntilExpiry < 0 
                          ? `${Math.abs(alert.daysUntilExpiry)}d overdue`
                          : `${alert.daysUntilExpiry}d left`
                        }
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-alerts">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto mb-3 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  </div>
                  <p className="font-medium">All documents are compliant</p>
                  <p className="text-sm">Great job maintaining standards!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card data-testid="card-recent-activity">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Activity className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Audit trail of recent actions</CardDescription>
                </div>
              </div>
              <Link href="/audit-log">
                <Button variant="ghost" size="sm" data-testid="link-view-all-activity">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activityLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded">
                    <Skeleton className="w-2 h-2 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-40 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))
              ) : activity && activity.length > 0 ? (
                activity.slice(0, 5).map((log, idx) => {
                  const isDocumentActivity = log.entityType === 'document' && log.documentTitle && log.entityId;
                  const isAdmin = currentUser?.role === 'admin';
                  
                  return (
                    <div 
                      key={log.id} 
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                      style={{ animation: `slideIn 0.3s ease-out ${idx * 0.1}s backwards` }}
                      data-testid={`activity-${log.id}`}
                    >
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" data-testid={`text-activity-action-${log.id}`}>
                          <span className="text-primary">{log.userName || 'System'}</span>{' '}
                          {log.action.replace('_', ' ')}{' '}
                          {isDocumentActivity ? (
                            <>
                              on document{' '}
                              {isAdmin ? (
                                <span
                                  className="text-primary underline cursor-pointer hover:text-primary/80"
                                  onClick={() => navigate(`/documents/${log.entityId}/edit`)}
                                  data-testid={`link-document-${log.entityId}`}
                                >
                                  {log.documentTitle}
                                </span>
                              ) : (
                                <span className="font-semibold">{log.documentTitle}</span>
                              )}
                            </>
                          ) : (
                            <>on {log.entityType}</>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground" data-testid={`text-activity-time-${log.id}`}>
                          {log.createdAt ? format(new Date(log.createdAt), 'MMM d, h:mm a') : ''}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-activity">
                  No recent activity
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Active Users */}
        <Card data-testid="card-active-users">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <img src={sahihLogoPath} alt="Sahih Logo" className="h-8 w-8 object-contain" />
              <div>
                <CardTitle className="text-base">Active Users</CardTitle>
                <CardDescription className="text-xs">Team members online</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-1">
              {activeUsers && activeUsers.length > 0 ? (
                activeUsers.slice(0, 8).map((user, idx) => {
                  const formatLastActive = (lastActivity: string | null) => {
                    if (!lastActivity) return 'Never active';
                    const now = new Date();
                    const last = new Date(lastActivity);
                    const diffMs = now.getTime() - last.getTime();
                    const diffMins = Math.floor(diffMs / (1000 * 60));
                    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    
                    if (diffMins < 1) return 'Just now';
                    if (diffMins < 60) return `${diffMins} min ago`;
                    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
                    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
                  };

                  return (
                    <div 
                      key={user.id}
                      className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors"
                      style={{ animation: `slideIn 0.3s ease-out ${idx * 0.05}s backwards` }}
                      data-testid={`active-user-${user.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                            <span className="text-xs font-semibold text-primary">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div 
                            className={`absolute -bottom-0 -right-0 w-2.5 h-2.5 rounded-full border-2 border-background ${
                              user.isOnline ? 'bg-green-500' : 'bg-gray-400'
                            }`}
                            data-testid={`status-dot-${user.id}`}
                          />
                        </div>
                        <div>
                          <p className="text-xs font-medium" data-testid={`text-user-name-${user.id}`}>{user.name}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{user.role.replace('_', ' ')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {user.isOnline ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] py-0 px-1.5">
                            Online
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground" data-testid={`text-last-active-${user.id}`}>
                            {formatLastActive(user.lastActivity)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No active users
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Task Completion Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTask && getTaskIcon(selectedTask.taskType)}
              {selectedTask?.taskType === 'download_approval' 
                ? 'Download Request'
                : selectedTask?.taskType === 'access_approval'
                ? 'Access Request'
                : `Complete Task: ${selectedTask?.taskType.charAt(0).toUpperCase()}${selectedTask?.taskType.slice(1)}`
              }
            </DialogTitle>
            <DialogDescription>
              {selectedTask?.taskType === 'download_approval' 
                ? `A user has requested permission to download ${selectedTask?.documentCode} - ${selectedTask?.title}`
                : selectedTask?.taskType === 'access_approval'
                ? `${selectedTask?.requesterName || 'A user'} has requested access to view ${selectedTask?.documentCode} - ${selectedTask?.title}`
                : `${selectedTask?.documentCode} - ${selectedTask?.title}`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {(selectedTask?.taskType === 'employee_review' || selectedTask?.taskType === 'employee_approve') ? (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-3">Employee Details</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name:</span>
                    <span className="ml-2 font-medium">{selectedTask?.employeeName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Designation:</span>
                    <span className="ml-2 font-medium">{selectedTask?.employeeJobTitle}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Reporting Officer:</span>
                    <span className="ml-2 font-medium">{selectedTask?.employeeSupervisorName || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Department:</span>
                    <span className="ml-2 font-medium">{selectedTask?.employeeDepartment}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <span className="ml-2 font-medium">{selectedTask?.employeeEmail}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone:</span>
                    <span className="ml-2 font-medium">{selectedTask?.employeePhone || 'N/A'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Task Details</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Document:</span>
                    <span className="ml-2 font-medium">{selectedTask?.documentCode}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Action:</span>
                    <span className="ml-2 font-medium capitalize">{selectedTask?.taskType}</span>
                  </div>
                </div>
              </div>
            )}

            {selectedTask?.taskType === 'employee_review' && (
              <div className="space-y-2">
                <Label htmlFor="select-approver">Select Approver for Final Approval *</Label>
                <Select value={selectedApproverId} onValueChange={setSelectedApproverId}>
                  <SelectTrigger id="select-approver" data-testid="select-approver">
                    <SelectValue placeholder="Choose who will approve this employee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(allUsers || []).filter(u => u.role === 'admin' || u.email === 'ceo@sahihcertify.com').map(user => (
                      <SelectItem key={user.id} value={String(user.id)}>
                        {user.name} ({user.role}) {user.email === 'ceo@sahihcertify.com' ? '- CEO (Default)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">The selected approver will receive this employee record for final approval.</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="comments">Comments (optional)</Label>
              <Textarea
                id="comments"
                placeholder="Add any comments about completing this task..."
                value={taskComments}
                onChange={(e) => setTaskComments(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              {(selectedTask?.taskType === 'employee_review' || selectedTask?.taskType === 'employee_approve') ? (
                <Link href="/hr" className="flex-1">
                  <Button variant="outline" className="w-full">
                    <Users className="w-4 h-4 mr-2" />
                    View Employee
                  </Button>
                </Link>
              ) : (
                <Link href={`/documents/${selectedTask?.documentId}/edit`} className="flex-1">
                  <Button variant="outline" className="w-full">
                    <FileText className="w-4 h-4 mr-2" />
                    View Document
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowTaskDialog(false)}>
              Cancel
            </Button>
            {selectedTask?.taskType === 'download_approval' ? (
              <>
                <Button 
                  variant="destructive"
                  onClick={() => {
                    if (selectedTask?.downloadRequestId) {
                      rejectDownloadMutation.mutate(selectedTask.downloadRequestId, {
                        onSuccess: () => {
                          toast({ title: "Download Rejected", description: `Download request for ${selectedTask.documentCode} has been rejected.` });
                          setShowTaskDialog(false);
                        },
                        onError: (error: Error) => {
                          toast({ title: "Error", description: error.message, variant: "destructive" });
                        },
                      });
                    }
                  }}
                  disabled={rejectDownloadMutation.isPending}
                >
                  <X className="w-4 h-4 mr-2" />
                  {rejectDownloadMutation.isPending ? "Rejecting..." : "Reject"}
                </Button>
                <Button 
                  onClick={() => {
                    if (selectedTask?.downloadRequestId) {
                      approveDownloadMutation.mutate(selectedTask.downloadRequestId, {
                        onSuccess: () => {
                          toast({ title: "Download Approved", description: `Download request for ${selectedTask.documentCode} has been approved.` });
                          setShowTaskDialog(false);
                        },
                        onError: (error: Error) => {
                          toast({ title: "Error", description: error.message, variant: "destructive" });
                        },
                      });
                    }
                  }}
                  disabled={approveDownloadMutation.isPending}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {approveDownloadMutation.isPending ? "Approving..." : "Approve Download"}
                </Button>
              </>
            ) : selectedTask?.taskType === 'access_approval' ? (
              <>
                <Button 
                  variant="destructive"
                  onClick={() => {
                    if (selectedTask?.accessRequestId) {
                      rejectAccessMutation.mutate(selectedTask.accessRequestId, {
                        onSuccess: () => {
                          toast({ title: "Access Denied", description: `Access request for ${selectedTask.documentCode} has been denied.` });
                          setShowTaskDialog(false);
                        },
                        onError: (error: Error) => {
                          toast({ title: "Error", description: error.message, variant: "destructive" });
                        },
                      });
                    }
                  }}
                  disabled={rejectAccessMutation.isPending}
                >
                  <X className="w-4 h-4 mr-2" />
                  {rejectAccessMutation.isPending ? "Denying..." : "Deny"}
                </Button>
                <Button 
                  onClick={() => {
                    if (selectedTask?.accessRequestId) {
                      approveAccessMutation.mutate(selectedTask.accessRequestId, {
                        onSuccess: () => {
                          toast({ title: "Access Granted", description: `${selectedTask.requesterName || 'User'} can now view ${selectedTask.documentCode}.` });
                          setShowTaskDialog(false);
                        },
                        onError: (error: Error) => {
                          toast({ title: "Error", description: error.message, variant: "destructive" });
                        },
                      });
                    }
                  }}
                  disabled={approveAccessMutation.isPending}
                >
                  <Unlock className="w-4 h-4 mr-2" />
                  {approveAccessMutation.isPending ? "Granting..." : "Grant Access"}
                </Button>
              </>
            ) : selectedTask?.taskType === 'employee_review' ? (
              <>
                <Button 
                  variant="destructive"
                  onClick={() => {
                    if (selectedTask?.employeeId) {
                      rejectEmployeeMutation.mutate({ id: selectedTask.employeeId, notes: taskComments || undefined }, {
                        onSuccess: () => {
                          toast({ title: "Employee Rejected", description: `Employee record for ${selectedTask.employeeName} has been rejected.` });
                          setShowTaskDialog(false);
                          queryClient.invalidateQueries({ queryKey: ['/api/my-tasks'] });
                        },
                        onError: (error: Error) => {
                          toast({ title: "Error", description: error.message, variant: "destructive" });
                        },
                      });
                    }
                  }}
                  disabled={rejectEmployeeMutation.isPending}
                >
                  <X className="w-4 h-4 mr-2" />
                  {rejectEmployeeMutation.isPending ? "Rejecting..." : "Reject"}
                </Button>
                <Button 
                  onClick={() => {
                    if (!selectedApproverId) {
                      toast({ title: "Please select an approver", description: "You must select who will approve this employee record.", variant: "destructive" });
                      return;
                    }
                    if (selectedTask?.employeeId) {
                      submitEmployeeForApprovalMutation.mutate({ id: selectedTask.employeeId, approverId: Number(selectedApproverId), notes: taskComments || undefined }, {
                        onSuccess: () => {
                          const approverName = allUsers?.find(u => u.id === Number(selectedApproverId))?.name || 'the approver';
                          toast({ title: "Review Complete", description: `Employee record for ${selectedTask.employeeName} has been sent to ${approverName} for approval.` });
                          setShowTaskDialog(false);
                          queryClient.invalidateQueries({ queryKey: ['/api/my-tasks'] });
                        },
                        onError: (error: Error) => {
                          toast({ title: "Error", description: error.message, variant: "destructive" });
                        },
                      });
                    }
                  }}
                  disabled={submitEmployeeForApprovalMutation.isPending || !selectedApproverId}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {submitEmployeeForApprovalMutation.isPending ? "Completing..." : "Complete Review & Submit"}
                </Button>
              </>
            ) : selectedTask?.taskType === 'employee_approve' ? (
              <>
                <Button 
                  variant="destructive"
                  onClick={() => {
                    if (selectedTask?.employeeId) {
                      rejectEmployeeMutation.mutate({ id: selectedTask.employeeId, notes: taskComments || undefined }, {
                        onSuccess: () => {
                          toast({ title: "Employee Rejected", description: `Employee record for ${selectedTask.employeeName} has been rejected.` });
                          setShowTaskDialog(false);
                          queryClient.invalidateQueries({ queryKey: ['/api/my-tasks'] });
                        },
                        onError: (error: Error) => {
                          toast({ title: "Error", description: error.message, variant: "destructive" });
                        },
                      });
                    }
                  }}
                  disabled={rejectEmployeeMutation.isPending}
                >
                  <X className="w-4 h-4 mr-2" />
                  {rejectEmployeeMutation.isPending ? "Rejecting..." : "Reject"}
                </Button>
                <Button 
                  onClick={() => {
                    if (selectedTask?.employeeId) {
                      approveEmployeeMutation.mutate({ id: selectedTask.employeeId, notes: taskComments || undefined }, {
                        onSuccess: () => {
                          toast({ title: "Employee Approved", description: `Employee record for ${selectedTask.employeeName} has been approved.` });
                          setShowTaskDialog(false);
                          queryClient.invalidateQueries({ queryKey: ['/api/my-tasks'] });
                        },
                        onError: (error: Error) => {
                          toast({ title: "Error", description: error.message, variant: "destructive" });
                        },
                      });
                    }
                  }}
                  disabled={approveEmployeeMutation.isPending}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {approveEmployeeMutation.isPending ? "Approving..." : "Approve Employee"}
                </Button>
              </>
            ) : (
              <Button 
                onClick={handleCompleteTask}
                disabled={completeTaskMutation.isPending}
              >
                {completeTaskMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Complete Task
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* My Performance & Compliance Dialog */}
      <Dialog open={showComplianceDialog} onOpenChange={setShowComplianceDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="bg-gradient-to-r from-primary to-primary/80 -mx-6 -mt-6 px-6 py-5 rounded-t-lg">
            <DialogTitle className="flex items-center gap-2 text-white text-xl">
              <Award className="w-6 h-6" />
              My Performance
            </DialogTitle>
            <DialogDescription className="text-white/80">
              Your personal metrics and team compliance overview
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
              <p className="text-sm text-muted-foreground mb-1">Overall Compliance Score</p>
              <div className="text-5xl font-bold text-primary">{complianceScore}%</div>
              <div className="flex justify-center gap-1 mt-2">
                {[...Array(5)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-8 h-2 rounded-full ${i < Math.ceil(complianceScore / 20) ? 'bg-primary' : 'bg-muted'}`}
                  />
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Target className="w-4 h-4" />
                My Task Performance
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-center">
                  <ClipboardList className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-blue-600">{myTasks?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Pending Tasks</p>
                </div>
                <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 text-center">
                  <FilePen className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-purple-600">
                    {myTasks?.filter(t => t.taskType === 'prepare').length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">To Prepare</p>
                </div>
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-center">
                  <FileCheck className="w-6 h-6 text-amber-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-amber-600">
                    {myTasks?.filter(t => t.taskType === 'review').length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">To Review</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-center">
                  <FileSignature className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-emerald-600">
                    {myTasks?.filter(t => t.taskType === 'approve').length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">To Approve</p>
                </div>
                <div className="p-4 rounded-lg bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 text-center">
                  <Download className="w-6 h-6 text-pink-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-pink-600">
                    {myTasks?.filter(t => t.taskType === 'download_approval' || t.taskType === 'access_approval').length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Access Requests</p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Team Document Status
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-700 dark:text-green-400">Approved</span>
                  </div>
                  <p className="text-3xl font-bold text-green-600">{stats?.approvedDocuments || 0}</p>
                  <p className="text-xs text-muted-foreground">Documents</p>
                </div>
                
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-amber-600" />
                    <span className="font-medium text-amber-700 dark:text-amber-400">Pending</span>
                  </div>
                  <p className="text-3xl font-bold text-amber-600">{stats?.pendingApprovals || 0}</p>
                  <p className="text-xs text-muted-foreground">Awaiting Approval</p>
                </div>
                
                <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    <span className="font-medium text-yellow-700 dark:text-yellow-400">Expiring Soon</span>
                  </div>
                  <p className="text-3xl font-bold text-yellow-600">{stats?.expiringDocuments || 0}</p>
                  <p className="text-xs text-muted-foreground">Within 30 Days</p>
                </div>
                
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="font-medium text-red-700 dark:text-red-400">Non-Compliant</span>
                  </div>
                  <p className="text-3xl font-bold text-red-600">{stats?.nonCompliantDocuments || 0}</p>
                  <p className="text-xs text-muted-foreground">Overdue Review</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Quick Summary
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Documents:</span>
                  <span className="font-medium">{stats?.totalDocuments || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">My Pending:</span>
                  <span className="font-medium">{myTasks?.length || 0}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowComplianceDialog(false)}>
              Close
            </Button>
            <Button onClick={() => { setShowComplianceDialog(false); navigate("/tasks"); }}>
              <ClipboardList className="w-4 h-4 mr-2" />
              View My Tasks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tasks Focus Dialog */}
      <Dialog open={showTasksFocusDialog} onOpenChange={setShowTasksFocusDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Today's Focus
            </DialogTitle>
            <DialogDescription>
              Your pending tasks - {format(currentTime, "EEEE, MMMM d, yyyy")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {myTasks && myTasks.length > 0 ? (
              <div className="space-y-3">
                {myTasks.map((task, idx) => (
                  <div 
                    key={`focus-${task.documentId}-${task.taskType}`}
                    className="p-4 rounded-lg border hover:border-primary cursor-pointer transition-all group"
                    onClick={() => {
                      setShowTasksFocusDialog(false);
                      handleOpenTask(task);
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                          {getTaskIcon(task.taskType)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{task.documentCode}</p>
                            <Badge className={`${getTaskBadgeColor(task.taskType)} text-xs`}>
                              {task.taskType.charAt(0).toUpperCase() + task.taskType.slice(1)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{task.title}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto mb-4 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <p className="font-bold text-lg text-green-700 dark:text-green-400">All Caught Up!</p>
                <p className="text-muted-foreground text-sm">No pending tasks for now.</p>
              </div>
            )}

            <div className="p-4 rounded-lg bg-muted">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Task Summary
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Pending:</span>
                  <span className="ml-2 font-medium">{myTasks?.length || 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <span className="ml-2 font-medium text-green-600">
                    {(myTasks?.length || 0) === 0 ? 'Complete' : 'In Progress'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTasksFocusDialog(false)}>
              Close
            </Button>
            <Button onClick={() => { setShowTasksFocusDialog(false); navigate("/tasks"); }}>
              <ClipboardList className="w-4 h-4 mr-2" />
              View All Tasks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
