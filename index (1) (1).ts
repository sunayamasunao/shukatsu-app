export type FlowStatus = 'pending' | 'done' | 'passed' | 'failed';
export type CompanyStatus = 'active' | 'offer' | 'declined' | 'rejected';

export interface Flow {
  id: string;
  name: string;
  deadline: string; // YYYY-MM-DD
  status: FlowStatus;
}

export interface Company {
  id: string;
  name: string;
  jobType: string;
  industry: string;
  mypageUrl: string;
  status: CompanyStatus;
  flows: Flow[];
  // 企業情報
  avgSalary: string;
  employees: string;
  location: string;
  founded: string;
  benefits: string;
  business: string;
  notes: string;
  concerns: string;
  createdAt: string;
}
