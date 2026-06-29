## Intent

Define the current SupplySync360 website navigation structure for Prompt Builder website content management.

## Website

SupplySync360

## Navigation Type

primary_site_navigation

## Header Navigation

| Order | Label | Route | Page File | Parent | Show | CTA | Notes |
|---:|---|---|---|---|---|---|---|
| 1 | Platform | /platform | pages/platform/overview.md |  | Yes | No | Group parent |
| 2 | AI Capabilities | /ai | pages/platform/ai.md | Platform | Yes | No | Header child |
| 3 | Security | /security | pages/platform/security.md | Platform | Yes | No | Header child |
| 4 | Free Risk Scan | /navigator | pages/platform/supply-risk-scan.md | Platform | Yes | Yes | Diagnostic CTA |
| 5 | Solutions | /solutions | pages/solutions/overview.md |  | Yes | No | Group parent |
| 6 | Industries | /solutions/industries | pages/solutions/industries/index.md | Solutions | Yes | No | Header child |
| 7 | Operating Models | /solutions/operating-models | pages/solutions/operating-models/index.md | Solutions | Yes | No | Header child |
| 8 | Business Size | /solutions/business-size | pages/solutions/business-size/index.md | Solutions | Yes | No | Header child |
| 9 | Resources | /resources | pages/resources/index.md |  | Yes | No | Group parent |
| 10 | Glossary | /glossary | pages/resources/glossary.md | Resources | Yes | No | Header child |
| 11 | FAQ | /faq | pages/resources/faq.md | Resources | Yes | No | Header child |
| 12 | About | /company/about | pages/company/about.md | Company | Yes | No | Header child |
| 13 | Client Feedback | /company/feedback | pages/company/client-feedback.md | Company | Yes | No | Header child |
| 14 | Contact | /contact | pages/company/contact.md | Company | Yes | Yes | Primary contact route |
| 15 | Book a Strategy Session | /contact | pages/company/contact.md |  | Yes | Yes | Header CTA |

## Footer Navigation

| Group | Order | Label | Route | Page File | Show | Notes |
|---|---:|---|---|---|---|---|
| Platform | 1 | Overview | /platform | pages/platform/overview.md | Yes |  |
| Platform | 2 | AI Capabilities | /ai | pages/platform/ai.md | Yes |  |
| Platform | 3 | Supply Risk Scan | /navigator | pages/platform/supply-risk-scan.md | Yes |  |
| Platform | 4 | Security | /security | pages/platform/security.md | Yes |  |
| Solutions | 1 | Industries | /solutions/industries | pages/solutions/industries/index.md | Yes |  |
| Solutions | 2 | Operating Models | /solutions/operating-models | pages/solutions/operating-models/index.md | Yes |  |
| Solutions | 3 | Business Size | /solutions/business-size | pages/solutions/business-size/index.md | Yes |  |
| Solutions | 4 | Resources | /resources | pages/resources/index.md | Yes |  |
| Solutions | 5 | Glossary | /glossary | pages/resources/glossary.md | Yes |  |
| Company | 1 | About | /company/about | pages/company/about.md | Yes |  |
| Company | 2 | Client Feedback | /company/feedback | pages/company/client-feedback.md | Yes |  |
| Company | 3 | Contact | /contact | pages/company/contact.md | Yes |  |
| Company | 4 | Portal Login | https://www.supplysync360portal.co.za | external | Yes | External link |

## Mobile Navigation

| Order | Label | Route | Page File | Show | Notes |
|---:|---|---|---|---|---|
| 1 | Home | / | pages/home.md | Yes |  |
| 2 | Platform | /platform | pages/platform/overview.md | Yes |  |
| 3 | AI Capabilities | /ai | pages/platform/ai.md | Yes |  |
| 4 | Security | /security | pages/platform/security.md | Yes |  |
| 5 | Free Risk Scan | /navigator | pages/platform/supply-risk-scan.md | Yes |  |
| 6 | Solutions | /solutions | pages/solutions/overview.md | Yes |  |
| 7 | Industries | /solutions/industries | pages/solutions/industries/index.md | Yes |  |
| 8 | Operating Models | /solutions/operating-models | pages/solutions/operating-models/index.md | Yes |  |
| 9 | Business Size | /solutions/business-size | pages/solutions/business-size/index.md | Yes |  |
| 10 | Resources | /resources | pages/resources/index.md | Yes |  |
| 11 | Glossary | /glossary | pages/resources/glossary.md | Yes |  |
| 12 | FAQ | /faq | pages/resources/faq.md | Yes |  |
| 13 | About | /company/about | pages/company/about.md | Yes |  |
| 14 | Client Feedback | /company/feedback | pages/company/client-feedback.md | Yes |  |
| 15 | Contact | /contact | pages/company/contact.md | Yes |  |

## Route Rules

Default Locale: en-ZA
Trailing Slash: No
Canonical Domain: https://www.supplysync360.co.za
Redirects Required:
- /company/contact -> /contact, if used.
- /strategy-session -> /contact, if introduced.
- External portal remains outside the website content structure.

## Navigation Notes

Navigation is the source of truth for site structure. Individual page files should reference this file, not duplicate the full navigation tree.
