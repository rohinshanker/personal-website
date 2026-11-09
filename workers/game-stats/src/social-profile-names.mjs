import { SOCIAL_PROFILE_NAME_BLOCKLIST } from "./constants.mjs";

// The browser draws every public name from the perchance "Sky Name Generator":
// four to eight ASCII letters, strictly alternating vowel and consonant from
// either class, rendered title-case. Arbitrary text cannot come out of it.
const VOWELS = "aeiou";
const CONSONANTS = "bcdfghjklmnpqrstvwxyz";
const TITLE_CASE_NAME_PATTERN = /^[A-Z][a-z]{3,7}$/;

const letterClass = (letter) => {
  if (VOWELS.includes(letter)) return "vowel";
  if (CONSONANTS.includes(letter)) return "consonant";
  return "";
};

const alternatesVowelsAndConsonants = (lowercaseName) => {
  let previousClass = "";
  for (const letter of lowercaseName) {
    const currentClass = letterClass(letter);
    if (!currentClass || currentClass === previousClass) return false;
    previousClass = currentClass;
  }
  return true;
};

export const isBlockedProfileName = (name) =>
  SOCIAL_PROFILE_NAME_BLOCKLIST.includes(String(name).toLowerCase());

/** True when `name` could have come out of the Sky Name Generator and is not blocklisted. */
export const isSkyGeneratedName = (name) => {
  if (typeof name !== "string" || !TITLE_CASE_NAME_PATTERN.test(name)) return false;
  const lowercaseName = name.toLowerCase();
  return alternatesVowelsAndConsonants(lowercaseName) && !isBlockedProfileName(lowercaseName);
};
