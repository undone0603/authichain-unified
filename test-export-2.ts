import * as dbModule from "./server/db";
console.log("Exports of ./server/db:", Object.keys(dbModule));
console.log("Is getHyperdriveDb a function:", typeof dbModule.getHyperdriveDb === 'function');
