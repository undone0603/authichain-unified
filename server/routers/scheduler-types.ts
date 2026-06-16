export interface ISchedulerRepository {
  getRegisteredJobs(): any[];
  getJobHistory(jobName?: string, limit?: number): Promise<any[]>;
  runJobManually(jobName: string): Promise<boolean>;
  getSystemStatus(): any;
  toggleKillSwitch(active: boolean): boolean;
}
