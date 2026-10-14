export type Zone = {
  id: number;
  number: number;
  name: string;
  leader: string;
  phone: string;
};

export type Cell = {
  id: number;
  name: string;
  area: string;
  leader: string;
  phone: string;
  meetingDay: string;
  meetingTime: string;
  members: number;
  zoneId: number;
};

export type Member = {
  id: string;
  cellId: number;
  name: string;
  gender: "Male" | "Female";
  age: number;
  phone: string;
  area: string;
  joinedAt: string;
};
