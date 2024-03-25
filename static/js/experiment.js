ERROR_EMAIL = 'fredcallaway@gmail.com'
PROLIFIC_CODE = 'CITBBJYS'

PARAMS = undefined

async function runExperiment() {
  // stimuli = await $.getJSON(`static/json/${CONDITION}.json`)

  // load configuration and set up parameters
  const config = await $.getJSON(`static/json/config/${CONDITION+1}.json`)
  PARAMS = _.merge({
    eye_tracking: false,
    hover_edges: false,
    hover_rewards: true,
    use_n_steps: false,
    vary_transition: true,
    show_points: false,
    forced_hovers: false,
    keep_hover: true,
    show_hovered_reward: true,
    show_predecessors: false,
    show_successor_rewards: false,
    reveal_by: 'hover',
    score_limit: 300,
    // time_limit: 600,
    points_per_cent: 3,
  }, config.parameters)
  console.log('config.parameters', config.parameters)

  PARAMS.graphRenderOptions = {
    onlyShowCurrentEdges: false,
    width: 600,
    height: 600,
    scaleEdgeFactor: 1,
    fixedXY: circleXY(config.trials.main[0].graph.length)
  };
  updateExisting(PARAMS, urlParams)
  psiturk.recordUnstructuredData('PARAMS', PARAMS);

  const trials = _.mapValues(config.trials, block => block.map(t => ({...PARAMS, ...t})))
  if (PARAMS.time_limit) {
    PARAMS.score_limit = undefined
  }
  if (PARAMS.score_limit) {
    PARAMS.points_per_cent = Infinity
  }
  const bonus = new Bonus({points_per_cent: PARAMS.points_per_cent, initial: 0})
  // makeGlobal({config, PARAMS, trials})


  // logEvent is how you save data to the database
  logEvent('experiment.initialize', {condition: CONDITION, params: PARAMS, trials: config.trials})
  enforceScreenSize(1000, 780)
  DISPLAY.css({width: 1000})


  async function instructions() {
    await new GraphInstructions({trials, bonus}).run(DISPLAY)
  }

  async function main() {
    DISPLAY.empty()
    let top = new TopBar({
      nTrial: trials.length,
      height: 70,
      width: 800,
    }).prependTo(DISPLAY)

    let score = new Score().attach(top.div)
    // score.addPoints(50)
    // bonus.addPoints(50)

    // if (local) PARAMS.time_limit = 300

    let timer = new Timer({label: 'Time Left: ', time: PARAMS.time_limit})
    if (PARAMS.time_limit) {
      timer.attach(top.div)
      timer.css({float: 'right'})
      timer.pause()
      timer.run()
    }

    registerEventCallback(info => {
      if (info.event == 'graph.addPoints') {
        score.addPoints(info.points)
        bonus.addPoints(info.points)
      }
      else if (info.event == 'graph.done') {
        timer.pause()
      }
      else if (info.event == 'graph.showGraph') {
        timer.unpause()
        // 2:18 2:24
      }
    })

    function checkDone() {
      if (PARAMS.score_limit && score.score > PARAMS.score_limit) {
        return true
      } else if (PARAMS.time_limit && timer.done) {
        return true
      }
      return false
    }

    let workspace = $('<div>').appendTo(DISPLAY)
    for (let trial of trials.main) {
      if (checkDone()) break
      workspace.empty()

      let start_message = PARAMS.score_limit ?
        `You're ${PARAMS.score_limit - score.score} points away from finishing` :
        bonus.reportBonus()
      let cg = new CircleGraph({...PARAMS, ...trial, start_message})
      await cg.run(workspace)
      timer.pause()

      psiturk.recordUnstructuredData('bonus', bonus.dollars())
      saveData()
    }
  }

  async function motivation() {
    DISPLAY.empty()
    let div = $('<div>').appendTo(DISPLAY).addClass('text')
    $('<p>').appendTo(div).html(markdown(`
      # Quick question
    `))

    let motivation = new Slider({
      prompt: 'How motivated did you feel to score points?',
      leftLabel: 'not at all motivated',
      rightLabel: 'very motivated'
    }).appendTo(div)

    let speedacc = new Slider({
      prompt: 'How do you think you balanced <b>speed</b> (doing many rounds) with <b>accuracy</b> (getting the most points possible on every round)?',
      leftLabel: 'only speed',
      rightLabel: 'only accuracy'
    }).appendTo(div)

    // new RadioButtons({
    //   prompt: 'How motivated did you feel to score points quickly?',
    //   choices: ['hardly', 'a bit', 'fairly', 'very']
    // }).appendTo(div)

    await button(div, 'submit').clicked
    // this information is already in the log, but let's put it in one place
    logEvent('motivation.submitted', getInputValues({motivation, speedacc}))
  }


  async function survey() {
    _.shuffle(CLINICAL_SURVEY.pages.slice(0,-1)).forEach((x, i) => {
      x.elements[0].rows = _.shuffle(x.elements[0].rows)
      CLINICAL_SURVEY.pages[i] = x
    })
    await new SurveyTrial(CLINICAL_SURVEY).run(DISPLAY)
  }

  async function debrief() {
    psiturk.recordUnstructuredData('completed', true)
    DISPLAY.empty()
    let div = $('<div>').appendTo(DISPLAY).addClass('text')
    $('<p>').appendTo(div).html(markdown(`
      # You're done!

      If you have any feedback please provide it below (feel free to leave it empty!)
    `))

    let feedback = text_box(div)

    await button(div, 'submit').clicked
    // this information is already in the log, but let's put it in one place
    logEvent('debrief.submitted', getInputValues({feedback}))
  }

  // using runTimeline is optional, but it allows you to jump to different blocks
  // with url parameters, e.g. http://localhost:8000/?block=main
  await runTimeline(
    instructions,
    main,
    motivation,
    survey,
    debrief
  )
};
