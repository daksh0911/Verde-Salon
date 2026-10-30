import { createContext, useContext } from 'react';
const D = {
  en: { services: 'Services', team: 'Team', contact: 'Contact', match: 'Find my look', book: 'Book a visit', login: 'Sign in', out: 'Sign out', visits: 'My visits', rewards: 'Rewards', desk: 'Front desk', portal: 'My day', open: 'Open now', closed: 'Closed now', nextFree: 'Next free chair', hero1: 'Good hair days,', hero2: 'made intentional.', sub: 'Unhurried hair, colour, skin and bridal appointments in Ahmedabad, with time held only for you.', menu: 'View the menu', kind: 'Kind words', people: 'The people' },
};
const Ctx = createContext(null);
export function I18n({ children }) {
  return <Ctx.Provider value={{ t: (k) => D.en[k] ?? k }}>{children}</Ctx.Provider>;
}
export const useT = () => useContext(Ctx);
