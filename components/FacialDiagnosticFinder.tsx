'use client';

import { useState } from 'react';
import Link from 'next/link';

interface FacialMatch {
  id: string;
  name: string;
  category: string;
  price: string;
  duration: string;
  downtime: string;
  serviceId: string;
  summary: string;
  keyActives: string[];
  altitudeBenefit: string;
  bestForTags: string[];
}

const CONCERNS = [
  { id: 'tewl', label: 'Altitude Dehydration & Flaking' },
  { id: 'congestion', label: 'Blackheads & Clogged Pores' },
  { id: 'acne', label: 'Active Breakouts & Inflammation' },
  { id: 'fuzz', label: 'Peach Fuzz & Rough Surface Texture' },
  { id: 'dull', label: 'Dullness & Lack of Pre-Event Glow' },
  { id: 'pigment', label: 'Hyperpigmentation & Sun Damage' },
  { id: 'laxity', label: 'Loss of Firmness & Jawline Laxity' },
  { id: 'sensitive', label: 'Sensitive Barrier & Environmental Stress' }
];

const FACIAL_DATABASE: FacialMatch[] = [
  {
    id: 'hydroboration',
    name: 'Hydroboration Facial',
    category: 'Hydradermabrasion & Infusion',
    price: '$120',
    duration: '45 min',
    downtime: 'Zero downtime',
    serviceId: 'ddd47915-309a-52fc-8bd0-0270524937f8',
    summary:
      'Simultaneously vacuums deep pore debris, dead skin, and blackheads while flooding newly cleared skin with pressurized hyaluronic acid, antioxidants, and peptide infusions.',
    keyActives: ['Low-Molecular Hyaluronic Acid', 'Peptide Matrix', 'Botanical Antioxidants', 'Salicylic Fluid Cleanser'],
    altitudeBenefit: 'Instantly quenches extreme Colorado high-desert dehydration while deeply clearing congested mountain dust and pollution from pores.',
    bestForTags: ['tewl', 'congestion', 'dull']
  },
  {
    id: 'dermaplaning',
    name: 'Dermaplaning Facial',
    category: 'Physical Exfoliation & Polish',
    price: '$150',
    duration: '45 min',
    downtime: 'Zero downtime (instant glow)',
    serviceId: '905d3530-3fbc-55dc-9cfc-76caa5dd92dd',
    summary:
      'A precise clinical physical exfoliation using a sterile surgical blade to gently remove dull stratum corneum build-up and vellus peach fuzz, boosting skincare penetration by up to 60%.',
    keyActives: ['Sterile Surgical Blade', 'Barrier Lipid Serums', 'Botanical Calming Mask', 'Squalane Barrier Oil'],
    altitudeBenefit: 'Removes the stubborn dry, dead surface layer typical of low-humidity climates so rich moisturizers and serums can actually absorb instead of sitting on top.',
    bestForTags: ['fuzz', 'dull', 'pigment']
  },
  {
    id: 'nano-infusion',
    name: 'Nano Infusion Facial',
    category: 'Transdermal Serum Delivery',
    price: '$200',
    duration: '60 min',
    downtime: 'Zero downtime',
    serviceId: '43a21192-c74e-55b7-b326-7c9e237d6875',
    summary:
      'Creates hundreds of thousands of microscopic pathways in the outermost epidermis without piercing living dermis, boosting active clinical serum absorption by up to 97%.',
    keyActives: ['Epidermal Growth Factors', 'Niacinamide (Vitamin B3)', 'Botanical Brighteners', 'Multi-Weight Hyaluronic Acid'],
    altitudeBenefit: 'Pushes deep hydration and corrective nutrients past the thickened high-altitude stratum corneum with zero needles, pain, or recovery.',
    bestForTags: ['tewl', 'pigment', 'dull', 'sensitive']
  },
  {
    id: 'floraessence-lactic',
    name: 'Floraessence Lactic Peel 20%',
    category: 'AHA Chemical Exfoliation',
    price: '$150',
    duration: '30 min',
    downtime: 'Zero to minimal visible peeling',
    serviceId: 'c5ef544a-97cf-5a36-9fab-c17813dfb537',
    summary:
      'A gentle, moisture-binding 20% lactic acid peel combined with botanical extracts to exfoliate dead surface cells while pulling water into the skin for bright, luminous tone.',
    keyActives: ['20% Lactic Acid (AHA Humectant)', 'Floraessence Botanical Extracts', 'Aloe Leaf Juice', 'Green Tea Polyphenols'],
    altitudeBenefit: 'Unlike harsh drying peels, lactic acid is a natural humectant that increases natural moisture retention while smoothing sun damage.',
    bestForTags: ['pigment', 'dull', 'tewl']
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour Glow Firming Facial',
    category: 'Lifting & Sculpting Facial',
    price: '$200',
    duration: '60 min',
    downtime: 'Zero downtime',
    serviceId: 'f169d079-2531-5bd2-83eb-7c58c8aafcf5',
    summary:
      'An intensive firming and contour-lifting facial featuring specialized lymphatic facial massage, peptide-rich botanical concentrates, and collagen-tightening botanical masks.',
    keyActives: ['Sculpting Peptide Complexes', 'Botanical Antioxidants', 'Firming Marine Algae', 'Vitamin C Ester'],
    altitudeBenefit: 'Depuffs sluggish lymphatic circulation and restores tone and bounce to skin stressed by dry mountain air and UV exposure.',
    bestForTags: ['laxity', 'dull', 'tewl']
  },
  {
    id: 'skin-clearing-intensive',
    name: 'Skin Clearing Facial (85 Min)',
    category: 'Deep Clinical Acne Protocol',
    price: '$150',
    duration: '85 min',
    downtime: 'Zero to mild redness for 2–4 hours',
    serviceId: '30eec773-1c29-5ad7-97d4-57d94be59c3c',
    summary:
      'A comprehensive clinical protocol including double deep cleansing, steam enzyme digestion, extensive manual extractions, high-frequency antibacterial therapy, and blue LED phototherapy.',
    keyActives: ['Fruit Enzymes', 'Salicylic Pore Clearing Serums', 'High-Frequency Ozone', 'Blue LED 415nm Phototherapy', 'Detoxifying Clay Mask'],
    altitudeBenefit: 'Deeply decongests pores without stripping the lipid barrier, preventing the rebound oil production that frequently occurs in dry climates.',
    bestForTags: ['acne', 'congestion']
  },
  {
    id: 'express-skin-clearing',
    name: 'Express Skin Clearing Facial (45 Min)',
    category: 'Targeted Blemish Maintenance',
    price: '$120',
    duration: '45 min',
    downtime: 'Zero downtime',
    serviceId: 'a475bb20-020e-5b08-a5bb-877b5520ca44',
    summary:
      'A focused 45-minute clinical treatment to clear active pore congestion, perform targeted extractions, and calm inflammation between full appointments.',
    keyActives: ['Salicylic Clearing Serum', 'Botanical Anti-Inflammatory Mask', 'High-Frequency Therapy', 'Calming Botanical Toner'],
    altitudeBenefit: 'Fast, targeted maintenance to keep pores clear and calm inflammation without disrupting your daily routine.',
    bestForTags: ['acne', 'congestion']
  },
  {
    id: 'getaway-glow',
    name: 'Getaway Glow',
    category: 'Pre-Event Radiance Revival',
    price: '$150',
    duration: '60 min',
    downtime: 'Zero downtime (event-ready)',
    serviceId: '19eaf939-2efe-5c64-ac7a-df2fedb2ef76',
    summary:
      'The ultimate pre-event skin revival combining an enzymatic polish, high-potency vitamin and peptide infusion, cooling cryo-globe lymphatic massage, and an illuminating botanical mask.',
    keyActives: ['Enzymatic Fruit Polish', 'High-Potency Vitamin C', 'Cryo-Globe Lymphatic Cooling', 'Illuminating Botanical Elixir'],
    altitudeBenefit: 'Instantly reverses travel fatigue and dry mountain dullness, leaving skin plump, radiant, and smooth for photos and events.',
    bestForTags: ['dull', 'tewl']
  },
  {
    id: 'wellness-signature',
    name: 'Wellness Signature Facial',
    category: 'Restorative Holistic Clinical',
    price: '$120',
    duration: '60 min',
    downtime: 'Zero downtime',
    serviceId: 'dd82574a-590c-5dc4-9450-b62bbc63ba20',
    summary:
      'A restorative, fully customized facial combining double botanical cleansing, steam, tailored enzyme exfoliation, gentle extractions, lymphatic facial massage, and nutrient-dense barrier masks.',
    keyActives: ['Custom Botanical Enzymes', 'Barrier Repair Ceramides', 'Lymphatic Herbal Elixir', 'Nutrient-Dense Botanical Mask'],
    altitudeBenefit: 'Restores essential moisture barrier equilibrium, soothes inflammation, and leaves skin deeply calm, hydrated, and supple.',
    bestForTags: ['sensitive', 'tewl', 'dull']
  }
];

export function FacialDiagnosticFinder({ bookUrl }: { bookUrl: string }) {
  const [selectedConcern, setSelectedConcern] = useState<string>('tewl');

  const matchedFacials = FACIAL_DATABASE.filter((f) => f.bestForTags.includes(selectedConcern));

  return (
    <div className="sf-facial-finder" role="region" aria-label="Colorado Altitude Facial Diagnostic Matcher">
      <div className="sf-facial-finder-head">
        <div className="sf-matcher-kicker">Interactive Skin Diagnostic</div>
        <h3 className="sf-facial-finder-title">Find Your Colorado Altitude Facial Match</h3>
        <p className="sf-facial-finder-sub">
          Select your primary skin challenge below to discover the exact clinical facial protocol,
          botanical actives, and barrier repair mechanism designed for your skin.
        </p>
      </div>

      {/* Concern Buttons */}
      <div className="sf-facial-concern-pills" role="tablist" aria-label="Skin Concerns">
        {CONCERNS.map((c) => {
          const isActive = c.id === selectedConcern;
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={isActive}
              className={`sf-facial-pill${isActive ? ' is-active' : ''}`}
              onClick={() => setSelectedConcern(c.id)}
            >
              <span className="sf-facial-pill-dot" />
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Results Grid */}
      <div className="sf-facial-results-grid">
        {matchedFacials.map((f) => (
          <article className="sf-facial-card" key={f.id}>
            <div className="sf-facial-card-head">
              <div className="sf-facial-badge">{f.category}</div>
              <h4 className="sf-facial-name">{f.name}</h4>
              <p className="sf-facial-summary">{f.summary}</p>
            </div>

            {/* Altitude Specific Benefit Box */}
            <div className="sf-altitude-callout">
              <span className="sf-altitude-label">✦ The Colorado Altitude Solution:</span>
              <p className="sf-altitude-text">{f.altitudeBenefit}</p>
            </div>

            {/* Key Botanical & Clinical Actives */}
            <div className="sf-facial-actives">
              <span className="sf-actives-label">Key Actives & Modalities:</span>
              <div className="sf-actives-pills">
                {f.keyActives.map((act, i) => (
                  <span className="sf-active-chip" key={i}>
                    {act}
                  </span>
                ))}
              </div>
            </div>

            {/* Footer / Booking */}
            <div className="sf-facial-card-foot">
              <div className="sf-facial-meta">
                <span className="sf-facial-price">{f.price}</span>
                <span className="sf-facial-dur">{f.duration} · {f.downtime}</span>
              </div>
              <Link href={`${bookUrl}?service=${f.serviceId}`} className="sf-btn primary">
                Reserve Facial &rarr;
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
