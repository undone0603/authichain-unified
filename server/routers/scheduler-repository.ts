import * as scheduler from "../scheduled-jobs";
import { ISchedulerRepository } from "./scheduler-types";

export class DbSchedulerRepository implements ISchedulerRepository {
  getRegisteredJobs(): any[] {
    return scheduler.getRegisteredJobs();
  }

  async getJobHistory(jobName?: string, limit?: number): Promise<any[]> {
    return await scheduler.getJobHistory(jobName, limit);
  }

  async runJobManually(jobName: string): Promise<boolean> {
    return await scheduler.runJobManually(jobName);
  }

  getSystemStatus(): any {
    return scheduler.getSystemStatus();
  }

  toggleKillSwitch(active: boolean): boolean {
    return scheduler.toggleKillSwitch(active);
  }
}
