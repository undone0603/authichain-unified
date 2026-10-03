# Made in USA Legal Model & Compliance Architecture

## Authoritative Framework

The AuthiChain Made-in-USA Compliance Engine is built around authoritative federal and state regulatory standards:

1. **FTC Made in USA Rule (16 CFR Part 323)**:
   - Unqualified claims require substantiation supporting the **"all or virtually all"** standard.
   - The system evaluates domestic manufacturing costs, direct labor, overhead, processing location, and foreign content significance.
   - **Important Distinction**: The historical 75% threshold is retained solely as a reference point and is never represented as the current universal legal FTC standard.

2. **Qualified Claims**:
   - Permitted when U.S. content is below the unqualified threshold but meets qualifying evidence criteria (e.g., percentage disclosures, specific domestic processes).

3. **Substantial Transformation**:
   - Evaluated independently of domestic cost percentages using HTS codes, processing steps, and CBP precedent.
   - If evidence is ambiguous or missing, the system **fails closed** to `REVIEW_REQUIRED` or `BLOCKED`.

4. **Jurisdictional Abstractions**:
   - Supports FTC, Federal Customs (19 CFR Part 134), and State of California (Business and Professions Code Section 17533.7) rulesets.
