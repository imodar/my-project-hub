// Shared sync utilities between Trips and Budget pages
// Both use localStorage as the source of truth

const TRIPS_KEY = "trips_data";
const BUDGETS_KEY = "budgets_data";

export interface TripExpense {
  id: string;
  name: string;
  amount: number;
}

export interface TripData {
  id: string;
  name: string;
  budget: number;
  expenses: TripExpense[];
}

export interface BudgetData {
  id: string;
  type: "month" | "project" | "trip";
  month: string;
  label?: string;
  income: number;
  expenses: { id: string; name: string; amount: number }[];
  sharedWith: string[];
  tripId?: string;
}

// Read trips from localStorage
export const loadTrips = (): any[] => {
  try {
    const d = localStorage.getItem(TRIPS_KEY);
    return d ? JSON.parse(d) : [];
  } catch { return []; }
};

// Save trips to localStorage
export const saveTrips = (trips: any[]) => {
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
};

// Read budgets from localStorage
export const loadBudgets = (): BudgetData[] => {
  try {
    const d = localStorage.getItem(BUDGETS_KEY);
    return d ? JSON.parse(d) : [];
  } catch { return []; }
};

// Save budgets to localStorage
export const saveBudgets = (budgets: BudgetData[]) => {
  localStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets));
};

// Sync a trip's expenses to budget (called from Trips page)
export const syncTripToBudget = (trip: TripData) => {
  const budgets = loadBudgets();
  const existingIdx = budgets.findIndex(b => b.tripId === trip.id);

  const tripBudget: BudgetData = {
    id: existingIdx >= 0 ? budgets[existingIdx].id : `trip-budget-${trip.id}`,
    type: "trip",
    month: `trip-${trip.id}`,
    label: trip.name,
    income: trip.budget,
    expenses: trip.expenses.map(e => ({ id: e.id, name: e.name, amount: e.amount })),
    sharedWith: [],
    tripId: trip.id,
  };

  if (existingIdx >= 0) {
    budgets[existingIdx] = tripBudget;
  } else {
    budgets.push(tripBudget);
  }

  saveBudgets(budgets);
};

// Sync budget expenses back to trips (called from Budget page)
export const syncBudgetToTrip = (tripId: string, expenses: { id: string; name: string; amount: number }[], budget: number) => {
  const trips = loadTrips();
  const tripIdx = trips.findIndex((t: any) => t.id === tripId);
  if (tripIdx >= 0) {
    trips[tripIdx].expenses = expenses;
    trips[tripIdx].budget = budget;
    saveTrips(trips);
  }
};

// Remove trip budget when trip is deleted
export const removeTripBudget = (tripId: string) => {
  const budgets = loadBudgets();
  saveBudgets(budgets.filter(b => b.tripId !== tripId));
};
