export type EPCISEventType =
  "ObjectEvent" | "AggregationEvent" | "TransformationEvent";

export type EPCISAction = "OBSERVING" | "ADDING" | "CHANGING" | "REMOVING";

export interface EPCISEvent {
  eventTime: string;
  recordTime: string;
  eventTimeZoneOffset: string;
  action: EPCISAction;
  bizStep: string;
  disposition: string;
  readPoint: string;
  bizLocation: string;
  bizTransaction: string;
  quantityList: {
    epcList: string[];
    epsList: string[];
    quantity: number;
  }[];
}

export interface EPCISResponse {
  version: string;
  events: EPCISEvent[];
}
