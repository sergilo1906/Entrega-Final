// Aquestes són les set funcions que pot cridar la web. Els scripts privats no es publiquen aquí.
export { getAvailability } from "./src/disponibilidad.js";
export { createBooking, cancelBooking, completeBooking } from "./src/reservas.js";
export { saveService, saveSchedule, setClosedDay } from "./src/administracion.js";
