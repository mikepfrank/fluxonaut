/* FLUXONAUT — biblio.js
 * Human-readable bibliography, shown via the References button.
 * Source of record: HUMAN-BIB.md in the project root (LaTeX-style --
 * numeric ranges normalized to en-dashes here).
 */
(function () {
  const F = (globalThis.FLUXON = globalThis.FLUXON || {});
  F.BIBLIOGRAPHY = [
    `[Landauer 1961] R. Landauer, "Irreversibility and Heat Generation in the Computing Process," IBM Journal of Research and Development, vol. 5, no. 3, pp. 183–191, Jul. 1961, doi: 10.1147/rd.53.0183.`,
    `[Bennett 1973] C. H. Bennett, "Logical Reversibility of Computation," IBM Journal of Research and Development, vol. 17, no. 6, pp. 525–532, Nov. 1973, doi: 10.1147/rd.176.0525.`,
    `[Ressler 1981] A. L. Ressler, "The Design of a Conservative Logic Computer and a Graphical Editor Simulator," M.S. thesis, Massachusetts Institute of Technology, 1981. https://dspace.mit.edu/handle/1721.1/15895`,
    `[Fredkin & Toffoli 1982] E. Fredkin and T. Toffoli, "Conservative Logic," International Journal of Theoretical Physics, vol. 21, no. 3–4, pp. 219–253, Apr. 1982, doi: 10.1007/BF01857727.`,
    `[Feynman 1986] R. P. Feynman, "Quantum Mechanical Computers," Foundations of Physics, vol. 16, no. 6, pp. 507–531, Jun. 1986, doi: 10.1007/BF01886518.`,
    `[ARC 2016] M. P. Frank, "Introducing Asynchronous Reversible Computing (ARC)", unpublished slide deck, 2016-17.`,
    `[ICRC 2017] M. P. Frank, "Asynchronous ballistic reversible computing," 2017 IEEE International Conference on Rebooting Computing (ICRC), Washington, DC, USA, 2017, pp. 1–8, doi: 10.1109/ICRC.2017.8123659.`,
    `[GRC 2018] M. P. Frank, "Generalized Reversible Computing," arXiv:1806.10183 [cs.ET], Jun. 2018. https://arxiv.org/abs/1806.10183`,
    `[ASC 2018] M. P. Frank, R. M. Lewis, N. A. Missert, M. A. Wolak and M. D. Henry, "Asynchronous Ballistic Reversible Fluxon Logic," in IEEE Transactions on Applied Superconductivity, vol. 29, no. 5, pp. 1–7, Aug. 2019, Art no. 1302007, doi: 10.1109/TASC.2019.2904962.`,
    `[JJ 2019] M. P. Frank and R. M. Lewis, "Implementing the Asynchronous Reversible Computing Paradigm in Josephson Junction Circuits", 21st Biennial U.S. Workshop on Superconductor Electronics, Devices, Circuits, and Systems (JJ Workshop), Skytop, PA Monday, October 21st, 2019. https://www.sandia.gov/app/uploads/sites/210/2022/06/JJ-workshop-v3.pdf`,
    `[ISEC 2019] M. P. Frank, R. M. Lewis, N. A. Missert, M. D. Henry, M. A. Wolak and E. P. DeBenedictis, "Semi-Automated Design of Functional Elements for a New Approach to Digital Superconducting Electronics: Methodology and Preliminary Results," 2019 IEEE International Superconductive Electronics Conference (ISEC), Riverside, CA, USA, 2019, pp. 1–6, doi: 10.1109/ISEC46533.2019.8990900.`,
    `[RM Pat.] M. P. Frank and E. DeBenedictis, "BALLISTIC REVERSIBLE SUPERCONDUCTING MEMORY ELEMENT", US Patent No. 11,289,156, Mar. 2022.`,
    `[ASC 2022] R. M. Lewis and M. P. Frank, "Two Circuits for Directing and Controlling Ballistic Fluxons," in IEEE Transactions on Applied Superconductivity, vol. 33, no. 5, pp. 1–5, Aug. 2023, Art no. 1800505, doi: 10.1109/TASC.2023.3244115.`,
    `[ICRC 2022] M. P. Frank and R. M. Lewis, "Ballistic Asynchronous Reversible Computing in Superconducting Circuits," 2022 IEEE International Conference on Rebooting Computing (ICRC), San Francisco, CA, USA, 2022, pp. 30–35, doi: 10.1109/ICRC57508.2022.00018.`,
    `[PRA 2023] K. D. Osborn and W. Wustmann, "Asynchronous reversible computing unveiled using ballistic shift registers," Physical Review Applied, vol. 19, no. 5, Art. no. 054034, May 2023, doi: 10.1103/PhysRevApplied.19.054034.`,
    `[LPS 2023] M. P. Frank and R. M. Lewis, "The Asynchronous Ballistic Approach to Reversible Computing in Superconductors," Laboratory for Physical Sciences (LPS) Advanced Computing Systems (ACS) Technical Update Seminar, College Park, MD, USA, 2023. https://www.sandia.gov/app/uploads/sites/210/2023/05/LPS-talk-May2023cSAND.pdf`,
    `[BARC 2023] M. P. Frank, "BARC Element Classifier (barc)", computer software, US DOE, 2023. https://github.com/sandialabs/barcs. doi: 10.11578/dc.20240910.18.`,
    `[BARC 2024] M. P. Frank, "Classification of BARC Elements Based on Single Flux Quanta (SFQ)", unpublished research memo, 2024.`,
    `[ASC 2024] M. P. Frank, R. M. Lewis and S. B. Kaplan, "First-Principles Derivation of Fluxon Viscosity and Associated Stopping Distance in Long Josephson Junctions," in IEEE Transactions on Applied Superconductivity, vol. 35, no. 5, pp. 1–5, Aug. 2025, Art no. 1700605, doi: 10.1109/TASC.2025.3527959.`,
    `[JJ 2025] M. P. Frank and S. B. Kaplan, "A Universal Circuit Element for Ballistic Asynchronous Reversible Computing in Superconductors", US Committee for Superconducting Electronics (USC4SCE) Josephson Junction Workshop, Santa Fe, NM, Apr. 6th–10th, 2025. https://tinyurl.com/Frank-Kaplan-JJ25`,
    `[CB Pat.] R. M. Lewis, M. P. Frank, and S. B. Kaplan, "BALLISTIC SUPERCONDUCTING CIRCUIT FOR ASYNCHRONOUS REVERSIBLE LOGIC ELEMENT", US Patent No. 12,620,993, May 2026.`,
    `[FKL 2026] M. P. Frank, S. B. Kaplan, and R. M. Lewis, title TBD, draft manuscript on polarized controlled barrier (CB), 2026.`,
    `[MPF&Grok] Conversation with Grok 3 about some game design ideas: https://x.com/i/grok/share/86376cb25f9548978c2449738d636a11.`,
    `[MPF@SNL] Archived mirror of Mike's research webpage from Sandia (2015-2024): https://tinyurl.com/MPF-SNL-mirror`,
  ];
})();
