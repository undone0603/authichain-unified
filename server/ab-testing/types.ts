export interface IAbTestingRepository {
  getAllAbTests(): Promise<any[]>;
  createAbTest(input: any): Promise<any>;
}
