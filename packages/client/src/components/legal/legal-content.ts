import type { LandingLang } from '../landing/landing-content.js';

/**
 * The privacy policy and terms of service of the Accounter service SB0 runs at acc.sb0.tech,
 * in Hebrew and English. Google's sign-in consent screen links to both pages, so they must stay
 * public and must keep describing how the service handles Google user data.
 *
 * Inline links are written `[text](href)`; `LegalText` renders them.
 */

export const LEGAL_OPERATOR = 'SB0 LTD';
export const LEGAL_CONTACT_EMAIL = 'asaf@sb0.tech';
/** The date both documents were last changed. Update it with any change to their substance. */
export const LEGAL_UPDATED_ISO = '2026-11-26';

const CONTACT = `[${LEGAL_CONTACT_EMAIL}](mailto:${LEGAL_CONTACT_EMAIL})`;
const GOOGLE_USER_DATA_POLICY = 'https://developers.google.com/terms/api-services-user-data-policy';

export type LegalDocId = 'privacy' | 'terms';

/** A paragraph, or a bulleted list. */
export type LegalBlock = string | { list: string[] };

export type LegalDocument = {
  title: string;
  intro: LegalBlock[];
  sections: { heading: string; body: LegalBlock[] }[];
};

export type LegalPageCopy = {
  updated: string;
  home: string;
  /** Says which version governs when the two languages differ. */
  versionNote: string;
  documents: Record<LegalDocId, LegalDocument>;
};

const EN: LegalPageCopy = {
  updated: 'Last updated: 26 November 2026',
  home: 'Home',
  versionNote:
    'This document is also available in Hebrew. If the versions differ, the Hebrew one governs.',
  documents: {
    privacy: {
      title: 'Privacy Policy',
      intro: [
        `Accounter at acc.sb0.tech is a service operated by ${LEGAL_OPERATOR} ("SB0", "we"). This policy explains what we collect when you use it, why, where it is kept, and the choices you have.`,
        'Accounter is built on open-source software maintained by The Guild. This policy covers the service SB0 runs, not other installations of that software.',
      ],
      sections: [
        {
          heading: 'Who is responsible',
          body: [
            `${LEGAL_OPERATOR} is responsible for personal data about the people who use the service.`,
            'The financial records a business keeps in Accounter, including details about its customers, suppliers and employees, belong to that business. The business decides what goes in and why, and we process those records on its behalf to provide the service.',
          ],
        },
        {
          heading: 'What we collect',
          body: [
            {
              list: [
                'Account details: your name, email address and, if you sign in with Google, your profile picture. If you sign in with an email and password, the password is stored by Google Identity Platform as a one-way hash that no one at SB0 can read.',
                'Your role and the businesses you belong to.',
                'Business records you add or connect: bank, card, crypto and payroll transactions; invoices, receipts and other documents; counterparties; ledger entries, reports and settings.',
                'Access credentials for sources you connect, such as a bank or card account. They are encrypted before they are stored.',
                'Technical data: server logs of requests (time, operation, your user and business identifiers, errors), used to run and secure the service.',
              ],
            },
            'We do not use advertising or analytics trackers.',
          ],
        },
        {
          heading: 'Signing in with Google',
          body: [
            'If you sign in with Google, Google shares your name, email address and profile picture with us. We use them only to create your account, sign you in and show who you are inside the app. Signing in does not give us access to your Gmail, Drive, contacts or any other Google data.',
            `Accounter's use and transfer of information received from Google APIs adheres to the [Google API Services User Data Policy](${GOOGLE_USER_DATA_POLICY}), including the Limited Use requirements. We do not sell this information, use it for advertising, or let people read it except to provide or secure the service, with your consent, or where the law requires.`,
          ],
        },
        {
          heading: 'How we use it',
          body: [
            {
              list: [
                'To provide the service: collect and match transactions, keep the ledger, and produce reports and tax files.',
                'To sign you in and apply the permissions your business gave you.',
                'To support you when you ask for help.',
                'To keep the service secure, prevent abuse and fix problems.',
                'To meet our legal obligations.',
              ],
            },
            'We do not sell personal data, use it for advertising, or use your business records to train AI models.',
          ],
        },
        {
          heading: 'Who we share it with',
          body: [
            {
              list: [
                "People in your workspace: users a business invites, such as its accountant, see that business's data according to their role.",
                'Google Cloud and Firebase, which host the service, its database and sign-in for us.',
                "Services a business connects, such as a bank, an invoicing service or a payroll provider: we exchange the data needed with them, on that business's instruction.",
                'Authorities, where the law requires it.',
              ],
            },
            'Reading documents with AI (OCR) is not turned on in this service. If we turn it on, we will update this policy first and name the provider.',
          ],
        },
        {
          heading: 'Where it is stored',
          body: [
            "Business records and account data are stored in Google Cloud in Israel (the Tel Aviv region). Sign-in runs on Google Identity Platform, which may process data in other countries under Google's data processing terms.",
          ],
        },
        {
          heading: 'How long we keep it',
          body: [
            "We keep data while your account or your business's workspace is active. Israeli law often requires tax records to be kept for seven years or more; each business decides how long to keep its records.",
            'When a workspace is closed, its data stays available for export for 30 days and is then deleted within a further 60 days, except where the law requires us to keep it. Backups roll over within 14 days.',
          ],
        },
        {
          heading: 'Security',
          body: [
            "Data is encrypted in transit and at rest. Credentials for connected sources are encrypted again with a key kept in Google Secret Manager. Each business's data is open only to its members, and the server enforces it. SB0 staff access customer data only when needed to run or support the service.",
          ],
        },
        {
          heading: 'Your rights',
          body: [
            `You can ask to see, correct or delete personal data about you, or to get a copy of it, by writing to ${CONTACT}. You have these rights under the Israeli Privacy Protection Law, 5741-1981, and, where it applies, the EU General Data Protection Regulation. You can also complain to the Israeli Privacy Protection Authority.`,
            "If your data is in a business's records (for example as its employee or customer), contact that business first. We will help it answer you.",
          ],
        },
        {
          heading: 'Browser storage',
          body: [
            "We use your browser's local storage to keep you signed in and to remember choices such as the page language and table settings. We do not use advertising or tracking cookies.",
          ],
        },
        {
          heading: 'Children',
          body: ['Accounter is a business service and is not meant for children.'],
        },
        {
          heading: 'Changes to this policy',
          body: [
            'We will post changes on this page and update the date above. If a change is significant, we will tell account holders by email or in the app before it takes effect.',
          ],
        },
        {
          heading: 'Contact',
          body: [`${LEGAL_OPERATOR}, ${CONTACT}`],
        },
      ],
    },
    terms: {
      title: 'Terms of Service',
      intro: [
        `These terms govern your use of Accounter at acc.sb0.tech, a service operated by ${LEGAL_OPERATOR} ("SB0", "we"). By signing in or using the service you accept them, for yourself and for the business you use it for.`,
      ],
      sections: [
        {
          heading: 'The service',
          body: [
            "Accounter collects a business's financial activity, matches transactions to their documents, keeps a double-entry ledger, and prepares reports and Israeli tax files. The features available may change as we develop the service.",
          ],
        },
        {
          heading: 'Accounts and workspaces',
          body: [
            'Access is by invitation or with our approval. Give accurate details, keep your sign-in secure, and tell us promptly about any use of your account you did not allow.',
            'The owner of a workspace decides who joins it and with what role, and is responsible for what those users do in it.',
          ],
        },
        {
          heading: 'Your data',
          body: [
            'Your business owns the data it puts into Accounter. You allow us to store and process it only to provide, secure and support the service.',
            'You confirm that you may upload that data, including personal data about employees, customers and suppliers, and that you will use it lawfully. The [Privacy Policy](/privacy) explains how we handle it.',
          ],
        },
        {
          heading: 'Professional responsibility',
          body: [
            'Accounter is a tool for you and your accountant. Automatic matching, classification and calculations can be wrong. Review the results before you rely on them. You remain responsible for every report, return and payment you submit to the Israel Tax Authority, the National Insurance Institute or anyone else.',
            'Accounter does not give accounting, tax or legal advice.',
          ],
        },
        {
          heading: 'Connected services',
          body: [
            'When you connect a bank, card, invoicing, payroll or other service, you authorise us to access it on your behalf with the credentials you provide. Those services have their own terms, and we are not responsible for their availability or for the data they send.',
          ],
        },
        {
          heading: 'Acceptable use',
          body: [
            "Do not use the service for anything unlawful, including money laundering or tax evasion; upload data you have no right to use; try to reach another workspace's data or probe or bypass the service's security; overload the service; or resell access without our written consent.",
          ],
        },
        {
          heading: 'Open-source software',
          body: [
            "Accounter's code is open source under the MIT licence and maintained by The Guild. These terms cover the service SB0 runs; the licence covers the code.",
          ],
        },
        {
          heading: 'Fees',
          body: [
            "Fees, if any, are those agreed with us in writing for your workspace. We will give at least 30 days' notice before changing them.",
          ],
        },
        {
          heading: 'Availability and changes',
          body: [
            'We work to keep the service available and your data safe, and we keep backups. The service is nevertheless provided "as is" and may be interrupted for maintenance or for reasons outside our control.',
            "We may change or remove features. If we stop the service, we will give at least 30 days' notice and a way to export your data.",
          ],
        },
        {
          heading: 'Ending your use',
          body: [
            'You can stop using the service at any time and ask us to close your workspace. We may suspend or close access after a serious breach of these terms, or where the law requires it.',
            'After a workspace is closed you have 30 days to export its data. We then delete it as the Privacy Policy describes.',
          ],
        },
        {
          heading: 'Liability',
          body: [
            'To the extent the law allows, SB0 is not liable for indirect or consequential loss, lost profits, or fines and penalties arising from reports or filings you submitted. Our total liability for any claim is limited to the fees you paid us in the 12 months before it arose. Nothing in these terms limits liability that the law does not allow to be limited.',
          ],
        },
        {
          heading: 'Law and jurisdiction',
          body: [
            'These terms are governed by the laws of the State of Israel. The competent courts in Tel Aviv-Yafo have exclusive jurisdiction.',
          ],
        },
        {
          heading: 'Changes to these terms',
          body: [
            'We may update these terms. We will post the new version here and update the date above. For significant changes we will notify account holders at least 14 days before they take effect; using the service after that date means you accept them.',
          ],
        },
        {
          heading: 'Contact',
          body: [`${LEGAL_OPERATOR}, ${CONTACT}`],
        },
      ],
    },
  },
};

const HE: LegalPageCopy = {
  updated: 'עודכן לאחרונה: 26 בנובמבר 2026',
  home: 'דף הבית',
  versionNote: 'המסמך זמין גם באנגלית. אם יש הבדל בין הנוסחים, הנוסח העברי קובע.',
  documents: {
    privacy: {
      title: 'מדיניות פרטיות',
      intro: [
        `Accounter בכתובת acc.sb0.tech הוא שירות שמפעילה ${LEGAL_OPERATOR} (״SB0״, ״אנחנו״). המדיניות הזו מסבירה איזה מידע אנחנו אוספים כשאתם משתמשים בשירות, למה, איפה הוא נשמר ומה האפשרויות שלכם.`,
        'Accounter בנוי על תוכנת קוד פתוח שמתחזקת The Guild. המדיניות חלה על השירות ש־SB0 מפעילה, ולא על התקנות אחרות של אותה תוכנה.',
      ],
      sections: [
        {
          heading: 'מי אחראי על המידע',
          body: [
            `${LEGAL_OPERATOR} אחראית על המידע האישי של מי שמשתמשים בשירות.`,
            'הרשומות הכספיות שעסק מנהל ב־Accounter, כולל פרטים על לקוחותיו, ספקיו ועובדיו, שייכות לאותו עסק. העסק מחליט מה נכנס למערכת ולאיזו מטרה, ואנחנו מעבדים את הרשומות האלה בשמו כדי לספק את השירות.',
          ],
        },
        {
          heading: 'איזה מידע אנחנו אוספים',
          body: [
            {
              list: [
                'פרטי חשבון: שם, כתובת דוא״ל, ואם נכנסתם עם Google – גם תמונת הפרופיל. אם נכנסתם עם דוא״ל וסיסמה, הסיסמה נשמרת ב־Google Identity Platform כגיבוב חד־כיווני שאיש ב־SB0 לא יכול לקרוא.',
                'התפקיד שלכם והעסקים שאתם שייכים אליהם.',
                'רשומות עסקיות שאתם מוסיפים או מחברים: תנועות בנק, אשראי, קריפטו ושכר; חשבוניות, קבלות ומסמכים אחרים; צדדים שכנגד; פקודות יומן, דוחות והגדרות.',
                'פרטי גישה למקורות שאתם מחברים, כמו חשבון בנק או כרטיס אשראי. הם מוצפנים לפני שהם נשמרים.',
                'מידע טכני: יומני שרת של בקשות (זמן, הפעולה, מזהי המשתמש והעסק, שגיאות), שמשמשים להפעלת השירות ולאבטחתו.',
              ],
            },
            'אנחנו לא משתמשים בכלי פרסום או מעקב סטטיסטי.',
          ],
        },
        {
          heading: 'כניסה עם Google',
          body: [
            'כשנכנסים עם Google, Google משתפת איתנו את השם, כתובת הדוא״ל ותמונת הפרופיל. אנחנו משתמשים בהם רק כדי ליצור את החשבון, להכניס אתכם ולהציג מי אתם בתוך המערכת. הכניסה לא נותנת לנו גישה ל־Gmail, ל־Drive, לאנשי הקשר או לכל מידע אחר שלכם ב־Google.',
            `השימוש של Accounter במידע שמתקבל מממשקי Google ובהעברתו עומד ב־[מדיניות נתוני המשתמשים של שירותי ה־API של Google](${GOOGLE_USER_DATA_POLICY}), כולל דרישות השימוש המוגבל (Limited Use). אנחנו לא מוכרים את המידע הזה, לא משתמשים בו לפרסום ולא מאפשרים לאנשים לקרוא אותו, אלא כדי לספק או לאבטח את השירות, בהסכמתכם, או כשהחוק מחייב.`,
          ],
        },
        {
          heading: 'איך אנחנו משתמשים במידע',
          body: [
            {
              list: [
                'כדי לספק את השירות: לאסוף ולהצליב תנועות, לנהל את היומן ולהפיק דוחות וקבצי מס.',
                'כדי להכניס אתכם ולהחיל את ההרשאות שהעסק נתן לכם.',
                'כדי לתמוך בכם כשאתם מבקשים עזרה.',
                'כדי לאבטח את השירות, למנוע שימוש לרעה ולתקן תקלות.',
                'כדי לעמוד בחובותינו לפי חוק.',
              ],
            },
            'אנחנו לא מוכרים מידע אישי, לא משתמשים בו לפרסום ולא מאמנים מודלי בינה מלאכותית על הרשומות העסקיות שלכם.',
          ],
        },
        {
          heading: 'עם מי אנחנו משתפים',
          body: [
            {
              list: [
                'אנשים בסביבת העבודה שלכם: משתמשים שהעסק מזמין, כמו רואה החשבון שלו, רואים את נתוני העסק לפי התפקיד שלהם.',
                'Google Cloud ו־Firebase, שמארחים עבורנו את השירות, את מסד הנתונים ואת מערכת הכניסה.',
                'שירותים שעסק מחבר, כמו בנק, שירות חשבוניות או ספק שכר: אנחנו מעבירים אליהם ומהם את המידע הנדרש, לפי הוראת העסק.',
                'רשויות, כשהחוק מחייב זאת.',
              ],
            },
            'קריאת מסמכים בבינה מלאכותית (OCR) אינה פעילה בשירות. אם נפעיל אותה, נעדכן קודם את המדיניות הזו ונציין את הספק.',
          ],
        },
        {
          heading: 'איפה המידע נשמר',
          body: [
            'הרשומות העסקיות ופרטי החשבונות נשמרים ב־Google Cloud בישראל (אזור תל אביב). מערכת הכניסה פועלת על Google Identity Platform, שעשויה לעבד מידע במדינות אחרות לפי תנאי עיבוד הנתונים של Google.',
          ],
        },
        {
          heading: 'כמה זמן אנחנו שומרים את המידע',
          body: [
            'אנחנו שומרים את המידע כל עוד החשבון שלכם או סביבת העבודה של העסק פעילים. החוק בישראל מחייב לרוב לשמור רשומות מס שבע שנים ויותר; כל עסק מחליט כמה זמן לשמור את הרשומות שלו.',
            'כשסביבת עבודה נסגרת, המידע שלה זמין לייצוא במשך 30 יום ונמחק בתוך 60 ימים נוספים, אלא אם החוק מחייב אותנו לשמור אותו. הגיבויים מתחלפים בתוך 14 יום.',
          ],
        },
        {
          heading: 'אבטחה',
          body: [
            'המידע מוצפן בהעברה ובאחסון. פרטי הגישה למקורות מחוברים מוצפנים פעם נוספת במפתח שנשמר ב־Google Secret Manager. נתוני כל עסק פתוחים רק לחבריו, והשרת אוכף זאת. עובדי SB0 ניגשים למידע של לקוחות רק כשצריך כדי להפעיל את השירות או לתמוך בו.',
          ],
        },
        {
          heading: 'הזכויות שלכם',
          body: [
            `אפשר לבקש לעיין במידע אישי עליכם, לתקן אותו, למחוק אותו או לקבל עותק שלו בפנייה אל ${CONTACT}. הזכויות האלה עומדות לכם לפי חוק הגנת הפרטיות, התשמ״א–1981, ובמקרים שהוא חל – גם לפי תקנות הגנת המידע של האיחוד האירופי (GDPR). אפשר גם להתלונן לרשות להגנת הפרטיות.`,
            'אם המידע עליכם נמצא ברשומות של עסק (למשל כעובדים או כלקוחות שלו), פנו קודם לאותו עסק. אנחנו נעזור לו לענות לכם.',
          ],
        },
        {
          heading: 'אחסון בדפדפן',
          body: [
            'אנחנו משתמשים באחסון המקומי של הדפדפן כדי לשמור אתכם מחוברים ולזכור העדפות כמו שפת הדף והגדרות טבלאות. אנחנו לא משתמשים בעוגיות פרסום או מעקב.',
          ],
        },
        {
          heading: 'ילדים',
          body: ['Accounter הוא שירות לעסקים ואינו מיועד לילדים.'],
        },
        {
          heading: 'שינויים במדיניות',
          body: [
            'נפרסם שינויים בדף הזה ונעדכן את התאריך שלמעלה. אם השינוי מהותי, נודיע לבעלי החשבונות בדוא״ל או במערכת לפני שייכנס לתוקף.',
          ],
        },
        {
          heading: 'יצירת קשר',
          body: [`${LEGAL_OPERATOR}, ${CONTACT}`],
        },
      ],
    },
    terms: {
      title: 'תנאי שימוש',
      intro: [
        `התנאים האלה חלים על השימוש ב־Accounter בכתובת acc.sb0.tech, שירות שמפעילה ${LEGAL_OPERATOR} (״SB0״, ״אנחנו״). בכניסה לשירות או בשימוש בו אתם מקבלים אותם, בשמכם ובשם העסק שבשבילו אתם משתמשים בשירות.`,
      ],
      sections: [
        {
          heading: 'השירות',
          body: [
            'Accounter אוסף את הפעילות הכספית של עסק, מצליב תנועות למסמכים שלהן, מנהל יומן בשיטת החשבונאות הכפולה ומכין דוחות וקבצי מס לפי דרישות הרשויות בישראל. היכולות הזמינות עשויות להשתנות ככל שנפתח את השירות.',
          ],
        },
        {
          heading: 'חשבונות וסביבות עבודה',
          body: [
            'הגישה היא בהזמנה או באישור שלנו. מסרו פרטים נכונים, שמרו על פרטי הכניסה שלכם ועדכנו אותנו מיד על כל שימוש בחשבון שלא אישרתם.',
            'הבעלים של סביבת עבודה מחליטים מי מצטרף אליה ובאיזה תפקיד, ואחראים למה שהמשתמשים האלה עושים בה.',
          ],
        },
        {
          heading: 'המידע שלכם',
          body: [
            'המידע שהעסק שלכם מכניס ל־Accounter שייך לו. אתם מתירים לנו לשמור ולעבד אותו רק כדי לספק את השירות, לאבטח אותו ולתמוך בו.',
            'אתם מאשרים שמותר לכם להעלות את המידע הזה, כולל מידע אישי על עובדים, לקוחות וספקים, ושתשתמשו בו כחוק. [מדיניות הפרטיות](/privacy) מסבירה איך אנחנו מטפלים בו.',
          ],
        },
        {
          heading: 'אחריות מקצועית',
          body: [
            'Accounter הוא כלי עבודה בשבילכם ובשביל רואה החשבון שלכם. התאמות, סיווגים וחישובים אוטומטיים עלולים לטעות. בדקו את התוצאות לפני שאתם מסתמכים עליהן. האחריות לכל דוח, הצהרה ותשלום שאתם מגישים לרשות המסים, לביטוח הלאומי או לכל גורם אחר נשארת שלכם.',
            'Accounter אינו נותן ייעוץ חשבונאי, מיסויי או משפטי.',
          ],
        },
        {
          heading: 'שירותים מחוברים',
          body: [
            'כשאתם מחברים בנק, כרטיס אשראי, שירות חשבוניות, שכר או שירות אחר, אתם מסמיכים אותנו לגשת אליו בשמכם עם פרטי הגישה שמסרתם. לשירותים האלה תנאים משלהם, ואיננו אחראים לזמינותם או למידע שהם שולחים.',
          ],
        },
        {
          heading: 'שימוש מותר',
          body: [
            'אסור להשתמש בשירות לכל מטרה בלתי חוקית, כולל הלבנת הון או העלמת מס; להעלות מידע שאין לכם זכות להשתמש בו; לנסות להגיע למידע של סביבת עבודה אחרת, לבחון את אבטחת השירות או לעקוף אותה; להעמיס על השירות; או למכור גישה אליו בלי הסכמתנו בכתב.',
          ],
        },
        {
          heading: 'תוכנת קוד פתוח',
          body: [
            'הקוד של Accounter פתוח ברישיון MIT ומתוחזק בידי The Guild. התנאים האלה חלים על השירות ש־SB0 מפעילה; הרישיון חל על הקוד.',
          ],
        },
        {
          heading: 'תשלום',
          body: [
            'התשלום, אם יש, הוא מה שסוכם איתנו בכתב לגבי סביבת העבודה שלכם. נודיע לפחות 30 יום מראש לפני שינוי בו.',
          ],
        },
        {
          heading: 'זמינות ושינויים',
          body: [
            'אנחנו פועלים כדי שהשירות יהיה זמין והמידע שלכם בטוח, ושומרים גיבויים. עם זאת, השירות ניתן ״כמות שהוא״ (AS IS) ועשוי להיקטע לצורך תחזוקה או מסיבות שאינן בשליטתנו.',
            'אנחנו רשאים לשנות יכולות או להסיר אותן. אם נפסיק את השירות, נודיע על כך לפחות 30 יום מראש ונאפשר לייצא את המידע שלכם.',
          ],
        },
        {
          heading: 'סיום השימוש',
          body: [
            'אפשר להפסיק להשתמש בשירות בכל עת ולבקש שנסגור את סביבת העבודה שלכם. אנחנו רשאים להשעות או לסגור גישה אחרי הפרה חמורה של התנאים, או כשהחוק מחייב זאת.',
            'אחרי שסביבת עבודה נסגרת יש לכם 30 יום לייצא את המידע שלה. אחר כך אנחנו מוחקים אותו כמתואר במדיניות הפרטיות.',
          ],
        },
        {
          heading: 'הגבלת אחריות',
          body: [
            'ככל שהחוק מתיר, SB0 אינה אחראית לנזק עקיף או תוצאתי, לאובדן רווחים, או לקנסות ולעיצומים הנובעים מדוחות או מהגשות שהגשתם. האחריות הכוללת שלנו לכל תביעה מוגבלת לסכום ששילמתם לנו ב־12 החודשים שלפני האירוע. שום דבר בתנאים אינו מגביל אחריות שהחוק אינו מתיר להגביל.',
          ],
        },
        {
          heading: 'דין ושיפוט',
          body: [
            'על התנאים האלה חלים דיני מדינת ישראל. לבתי המשפט המוסמכים בתל אביב–יפו סמכות שיפוט ייחודית.',
          ],
        },
        {
          heading: 'שינויים בתנאים',
          body: [
            'אנחנו רשאים לעדכן את התנאים. נפרסם את הנוסח החדש כאן ונעדכן את התאריך שלמעלה. על שינויים מהותיים נודיע לבעלי החשבונות לפחות 14 יום לפני שייכנסו לתוקף; המשך השימוש בשירות אחרי המועד הזה פירושו שאתם מקבלים אותם.',
          ],
        },
        {
          heading: 'יצירת קשר',
          body: [`${LEGAL_OPERATOR}, ${CONTACT}`],
        },
      ],
    },
  },
};

export const LEGAL_COPY: Record<LandingLang, LegalPageCopy> = { en: EN, he: HE };
