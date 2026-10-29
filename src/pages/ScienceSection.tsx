const TOPICS: { title: string; body: string; sources: string[] }[] = [
  {
    title: 'How hard each set was',
    body:
      'There’s no effort input. Ember estimates your one-rep max from your best sets (Wathen equation) and works out how many more reps the weight allowed — your reps in reserve (RIR). A new best is assumed to be ~2 reps short of failure, as is typical. Sets within about 4 reps of failure count as hard sets.',
    sources: [
      'Wathen D (1994). Load assignment. In: Essentials of Strength Training and Conditioning. NSCA.',
      'LeSuer DA et al. (1997). Accuracy of prediction equations for estimating 1-RM. J Strength Cond Res 11(4):211–213.',
      'Zourdos MC et al. (2016). Novel RPE scale measuring repetitions in reserve. J Strength Cond Res 30(1):267–275.',
      'Helms ER et al. (2016). Application of the RIR-based RPE scale for resistance training. Strength Cond J 38(4):42–49.',
      'Refalo MC et al. (2023). Proximity-to-failure and hypertrophy: meta-analysis. Sports Med 53:649–665.',
    ],
  },
  {
    title: 'Fatigue and recovery (the red glow)',
    body:
      'Each session adds fatigue in hard-set equivalents; sets to failure cost more, and eccentric-heavy lifts (RDLs, Nordics) and exercises you haven’t done in 3 weeks cost extra. Fatigue fades exponentially with a time constant per muscle — a typical hard session is ready again in ~32h (abs, forearms) to ~72h (hamstrings, lower back).',
    sources: [
      'Banister EW et al. (1975). A systems model of training for athletic performance. Aust J Sports Med 7:57–61.',
      'Morán-Navarro R et al. (2017). Recovery after training leading or not to failure. Eur J Appl Physiol 117:2387–2399.',
      'Hody S et al. (2019). Eccentric muscle contractions: risks and benefits. Front Physiol 10:536.',
      'McHugh MP (2003). The repeated bout effect. Scand J Med Sci Sports 13:88–97.',
    ],
  },
  {
    title: 'Football recovery',
    body:
      'A hard 90-minute match leaves hamstrings, adductors, calves and quads needing about 72 hours, scaled by the minutes and effort you log.',
    sources: ['Nédélec M et al. (2012). Recovery in soccer: part I. Sports Med 42(12):997–1015.'],
  },
  {
    title: 'Weekly volume',
    body:
      'The Volume view targets 10–20 hard sets per muscle per week. Exercises where a muscle only assists count half.',
    sources: [
      'Schoenfeld BJ, Ogborn D, Krieger JW (2017). Dose-response of weekly volume and muscle mass. J Sports Sci 35(11):1073–1082.',
      'Pelland JC et al. (2024). The resistance training dose-response: meta-regressions. SportRxiv (preprint).',
    ],
  },
  {
    title: 'Training load',
    body:
      'Load is minutes × effort (session RPE). The acute:chronic ratio compares 7- and 28-day exponentially weighted averages; 0.8–1.3 is the commonly cited sweet spot. Treat it as a rough guide — its link to injury is debated. Monotony flags weeks with too little difference between hard and easy days.',
    sources: [
      'Foster C et al. (2001). A new approach to monitoring exercise training. J Strength Cond Res 15(1):109–115.',
      'Foster C (1998). Monitoring training and overtraining syndrome. Med Sci Sports Exerc 30(7):1164–1168.',
      'Gabbett TJ (2016). The training–injury prevention paradox. Br J Sports Med 50:273–280.',
      'Williams S et al. (2017). Better way to determine the acute:chronic workload ratio? Br J Sports Med 51:209–210.',
      'Impellizzeri FM et al. (2020). ACWR: conceptual issues and fundamental pitfalls. Int J Sports Physiol Perform 15:907–913.',
    ],
  },
  {
    title: 'Progression suggestions',
    body:
      'Add weight once you hit the top of the rep range on every set two sessions in a row (+~2.5% upper body, +~5% lower body); otherwise add a rep.',
    sources: ['ACSM (2009). Progression models in resistance training for healthy adults. Med Sci Sports Exerc 41(3):687–708.'],
  },
];

export function ScienceSection() {
  return (
    <section className="card science">
      <h3>How the numbers work</h3>
      <p className="muted small">Estimates based on published research — useful guides, not medical advice. Listen to your body.</p>
      {TOPICS.map((t) => (
        <details key={t.title}>
          <summary>{t.title}</summary>
          <p>{t.body}</p>
          <ul className="sources">
            {t.sources.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </details>
      ))}
    </section>
  );
}
