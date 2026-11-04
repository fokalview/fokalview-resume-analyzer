import type { Suggestion } from "../components/SearchableSelect";

// ISO 3166-1 alpha-2 identifiers; display names come from the browser's Unicode CLDR Intl data.
// The stored value remains readable text. Custom values are always available for changes/territories.
const COUNTRY_CODES = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" ");
const regions = new Intl.DisplayNames(["en"], { type: "region" });
export const COUNTRY_SUGGESTIONS: Suggestion[] = COUNTRY_CODES.map(code => ({ value: regions.of(code) || code, label: regions.of(code) || code, aliases: [code, ...(code === "US" ? ["USA", "United States of America"] : code === "GB" ? ["UK", "Great Britain"] : [])] })).sort((a, b) => a.label.localeCompare(b.label));
const US_REGIONS = "Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|District of Columbia|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming".split("|");
const US_CODES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
const CA_REGIONS = "Alberta|British Columbia|Manitoba|New Brunswick|Newfoundland and Labrador|Northwest Territories|Nova Scotia|Nunavut|Ontario|Prince Edward Island|Quebec|Saskatchewan|Yukon".split("|");
const CA_CODES = "AB BC MB NB NL NT NS NU ON PE QC SK YT".split(" ");
export function regionSuggestions(country: string): Suggestion[] {
  if (/^(united states( of america)?|us|usa)$/i.test(country.trim())) return US_REGIONS.map((value, index) => ({ value, label: value, aliases: [US_CODES[index]] }));
  if (/^(canada|ca)$/i.test(country.trim())) return CA_REGIONS.map((value, index) => ({ value, label: value, aliases: [CA_CODES[index]] }));
  return [];
}
export const CURRENCY_SUGGESTIONS: Suggestion[] = [
  { value: "USD", label: "USD — US dollar" }, { value: "CAD", label: "CAD — Canadian dollar" },
  { value: "EUR", label: "EUR — Euro" }, { value: "GBP", label: "GBP — British pound" },
  { value: "AUD", label: "AUD — Australian dollar" }, { value: "INR", label: "INR — Indian rupee" }
];
