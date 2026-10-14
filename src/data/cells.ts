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

// ZONES - 15 ZONES FINAL
export const zones: Zone[] = [
  { id: 1, number: 1, name: "KALINGALINGA ZONE", leader: "Pastor Tehilla", phone: "0970000001" },
  { id: 2, number: 2, name: "AVONDALE ZONE", leader: "Deaconess Memory", phone: "0970000002" },
  { id: 3, number: 3, name: "CHALALA ZONE", leader: "Pastor Elias", phone: "0970000003" },
  { id: 4, number: 4, name: "KABWATA ZONE", leader: "Deaconess Hope", phone: "0970000004" },
  { id: 5, number: 5, name: "NORTHMEAD ZONE", leader: "Deacon Caleb", phone: "0760261629" },
  { id: 6, number: 6, name: "KALUNDU ZONE", leader: "Deaconess Phaless", phone: "0970000006" },
  { id: 7, number: 7, name: "KAUNDA SQUARE STAGE 1 ZONE", leader: "Deacon Chris", phone: "0970000007" },
  { id: 8, number: 8, name: "MUNALI / KSQ STAGE 2 ZONE", leader: "Deaconess Maria", phone: "0977433270" },
  { id: 9, number: 9, name: "CHELSTONE ZONE", leader: "Deaconess Lontia", phone: "0977521845" },
  { id: 10, number: 10, name: "FOXDALE / MEANWOOD ZONE", leader: "Deaconess Belia", phone: "0970000010" },
  { id: 11, number: 11, name: "CHAZANGA ZONE", leader: "Deacon Hanyama", phone: "0970000011" },
  { id: 12, number: 12, name: "MATER0 / JAMAICA ZONE", leader: "Brother Hosea", phone: "0777411038" },
  { id: 13, number: 13, name: "KANYAMA ZONE", leader: "No zone leader", phone: "0970000013" },
  { id: 14, number: 14, name: "ZAF / MEANWOOD NDEKE ZONE", leader: "Pastor Jesper", phone: "0970000014" },
  { id: 15, number: 15, name: "CAMPUS MINISTRY", leader: "To Be Assigned", phone: "0970000015" },
];

// FINAL CELLS - CORRECTED SPELLING & ZONE ASSIGNMENTS
export const cells: Cell[] = [
  { id: 1, name: "CHELSTONE CELL", area: "Chelstone", leader: "RABECA SIKASUNGE", phone: "0976835184", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 22, zoneId: 9 },
  { id: 2, name: "JAMAICA CELL", area: "Jamaica", leader: "HORSERE", phone: "0777411038", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 18, zoneId: 12 },
  { id: 3, name: "CHALALA CELL B", area: "Chalala", leader: "PRECIOUS", phone: "0974999594", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 20, zoneId: 3 },
  { id: 4, name: "CHAZANGA CELL A", area: "Chazanga", leader: "DAISY", phone: "0979875049", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 16, zoneId: 11 },
  { id: 5, name: "HELLEN KAUNDA", area: "Hellen Kaunda", leader: "AUNTIE UNICE", phone: "0750523734", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 19, zoneId: 1 },
  { id: 6, name: "FOXDALE A", area: "Foxdale", leader: "THARESA NJOPE", phone: "0975917981", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 21, zoneId: 10 },
  { id: 7, name: "FOXDALE B", area: "Foxdale", leader: "DEACONESS TAONGA", phone: "0978787845", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 17, zoneId: 10 },
  { id: 8, name: "GARDEN CELL", area: "Garden", leader: "DEACON CALEB", phone: "0760261629", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 24, zoneId: 5 },
  { id: 9, name: "KABANANA", area: "Kabanana", leader: "MUMBI RONERD", phone: "0975467333", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 15, zoneId: 11 },
  { id: 10, name: "KALINGALINGA CELL C", area: "Kalingalinga", leader: "MAMBO", phone: "0976700319", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 25, zoneId: 1 },
  { id: 11, name: "KALINGALINGA CELL A", area: "Kalingalinga", leader: "LOUIE", phone: "0974301060", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 23, zoneId: 1 },
  { id: 12, name: "KAUNDA SQUARE STAGE 2A", area: "Kaunda Square", leader: "DEACONESS MARIA", phone: "0977433270", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 20, zoneId: 8 },
  { id: 13, name: "KAUNDA SQUARE D", area: "Kaunda Square", leader: "DEACON CHRISPINE", phone: "0978315099", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 18, zoneId: 7 },
  { id: 14, name: "KAUNDA SQUARE B", area: "Kaunda Square", leader: "GIFT LUPIYA", phone: "0954816886", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 19, zoneId: 7 },
  { id: 15, name: "KAUNDA SQUARE A", area: "Kaunda Square", leader: "YVONNE PHIRI", phone: "0977442927", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 22, zoneId: 7 },
  { id: 16, name: "MEANWOOD PHASE 2", area: "Meanwood Phase 2", leader: "JOY", phone: "0976909813", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 16, zoneId: 10 },
  { id: 17, name: "MEANWOOD PHASE CELL", area: "Meanwood", leader: "RAPHAEL MHAAMONGA", phone: "0779213485", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 20, zoneId: 10 },
  { id: 18, name: "MEANWOOD PHASE 3", area: "Meanwood Phase 3", leader: "MIMI", phone: "0770227414", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 18, zoneId: 10 },
  { id: 19, name: "MEANWOOD PHASE 4", area: "Meanwood Phase 4", leader: "MRS CHALAWILA", phone: "0973921311", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 21, zoneId: 10 },
  { id: 20, name: "MEANWOOD NDEKE PHASE 3", area: "Meanwood Ndeke", leader: "CAROL", phone: "0770774494", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 17, zoneId: 14 },
  { id: 21, name: "MEANWOOD PHASE 3 A", area: "Meanwood Phase 3", leader: "ANNIE B", phone: "0977808706", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 15, zoneId: 10 },
  { id: 22, name: "MEANWOOD PHASE 2 A", area: "Meanwood Phase 2", leader: "DEACONESS KAPOTA", phone: "0962483264", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 19, zoneId: 10 },
  { id: 23, name: "CHISAMBA", area: "Chisamba", leader: "KELVINE KAPAMBWE", phone: "0977987120", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 14, zoneId: 10 },
  { id: 24, name: "HANDSWORTH", area: "Handsworth", leader: "DEACONESS LISTER", phone: "0763961228", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 16, zoneId: 6 },
  { id: 25, name: "NGOMBE CELL", area: "Ngombe", leader: "HARRIET MWILA", phone: "0777606303", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 20, zoneId: 6 },
  { id: 26, name: "TWIN PALM", area: "Twin Palm", leader: "SHAMISO MWAPE", phone: "0972314595", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 18, zoneId: 10 },
  { id: 27, name: "SALAMA PARK", area: "Salama Park", leader: "DEACON BRAIN", phone: "0975812367", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 22, zoneId: 2 },
  { id: 28, name: "ROMA CELL", area: "Roma", leader: "JULIE", phone: "0979036669", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 17, zoneId: 6 },
  { id: 29, name: "NORTHMEAD CELL", area: "Northmead", leader: "TONDA", phone: "0969919504", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 19, zoneId: 5 },
  { id: 30, name: "KALUNDU CELL", area: "Kalundu", leader: "NAOME NAMBEYE HR", phone: "0766925591", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 21, zoneId: 6 },
  { id: 31, name: "OBAMA CELL", area: "Obama", leader: "DEACONESS LOTIA", phone: "0977521845", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 16, zoneId: 9 },
  { id: 32, name: "RANCHIDALE CELL", area: "Ranchdale", leader: "DEACON MWYIA", phone: "0970839000", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 18, zoneId: 10 },
  { id: 33, name: "KABWATA CELL", area: "Kabwata", leader: "SIBONGILE KAMWI", phone: "0975864734", meetingDay: "Tuesday", meetingTime: "18:00 - 19:00", members: 20, zoneId: 4 },
];

