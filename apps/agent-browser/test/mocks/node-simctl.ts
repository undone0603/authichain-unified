export class Simctl {
  udid?: string;
  async getDevices() { return []; }
  async bootDevice() {}
  async shutdownDevice() {}
  async createDevice() { return 'mock-udid'; }
  async deleteDevice() {}
}
export default { Simctl };
