ERROR_EMAIL = 'fredcallaway@gmail.com'
PROLIFIC_CODE = 'CITBBJYS'

PARAMS = undefined

async function runExperiment() {
  // stimuli = await $.getJSON(`static/json/${CONDITION}.json`)

  // load configuration and set up parameters
  const config = await $.getJSON(`static/json/config/${CONDITION+1}.json`)
  PARAMS = _.merge({
    // hover_edges: false,
    revealed: false,  // disable
    hover_rewards: true,
    keep_hover: true,
    show_hovered_reward: true,
    reveal_by: 'hover',
    points_per_cent: 3,
  }, config.parameters)
  console.log('config.parameters', config.parameters)

  PARAMS.graphRenderOptions = {
    onlyShowCurrentEdges: false,
    scale: .5, // scales size of nodes, numbers, arrows, edge width
    width: 600,
    height: 600,
    fixedXY: circleXY(config.trials.main[0].graph.length)
    // fixedXY: PARAMS.graphCoordinates // SIXING: define this and delete previous line
  };
  updateExisting(PARAMS, urlParams)
  psiturk.recordUnstructuredData('PARAMS', PARAMS);

  // this line makes everything in PARAMS available in CircleGraph.options
  const trials = _.mapValues(config.trials, block => block.map(t => ({...PARAMS, ...t})))
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

    registerEventCallback(info => {
      if (info.event == 'graph.addPoints') {
        score.addPoints(info.points)
        bonus.addPoints(info.points)
      }
    })

    let workspace = $('<div>').appendTo(DISPLAY)
    for (let trial of trials.main) {
      workspace.empty()

      let start_message = bonus.reportBonus()
      let cg = new CircleGraph({...PARAMS, ...trial, start_message})
      await cg.run(workspace)
      psiturk.recordUnstructuredData('bonus', bonus.dollars())
      saveData()
    }
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
    debrief
  )
};
