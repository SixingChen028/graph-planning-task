const DEFAULT_INSTRUCT_HELP= `
  Use the << and >> buttons to flip through the sections. You have
  to follow all the instructions on a page before you can advance to the next one.
  If you get stuck, try clicking << and then >> to start the section over.
`

class GraphInstructions extends Instructions {
  constructor(options={}) {
    super({...options, promptHeight: 100, width: 800})
    this.trials = options.trials
    window.instruct = this
  }

  // the stages run in the order that they're defined
  // you can jump to a specific stage using it's position e.g.
  // http://127.0.0.1:8000/?instruct=2

  async stage_welcome() {
    this.setPrompt(`
      Thanks for participating! We'll start with some quick instructions.

      _psst: you can use the arrows above to flip through the pages_
    `)

    await this.button()
    this.runNext()
  }

  async stage_intro() {

    let trial = {...this.trials.intro[0], revealed: true}
    let cg = new CircleGraph(trial).attach(this.content);
    cg.showGraph()

    this.setPrompt(`Welcome! In this experiment, you will play a game on the board shown below.`)
    await this.button()

    this.setPrompt(`Your current location on the board is highlighted in red.`)
    cg.setCurrentState(trial.start)
    await this.button()

    this.setPrompt(`You can move one step by clicking on a location that has an arrow pointing from your current location.`)
    let next_states = cg.graph.successors(trial.start)
    for (const s of next_states) {
      $(`.GraphNavigation-State-${s}`).addClass('GraphNavigation-State-Highlighted')
    }
    await this.button()

    this.setPrompt(`After the first step, your location will move **randomly** until it reaches a location with no outgoing connections.`)
    
    // Function to perform BFS and find leaf nodes
    function findLeafNodes(graph, start) {
      let visited = new Set();
      let queue = [start];
      let leafNodes = [];

      while (queue.length > 0) {
        let current = queue.shift();
        visited.add(current);
        let successors = graph.successors(current);

        // If no successors, it's a leaf node
        if (!successors || successors.length === 0) {
          leafNodes.push(current);
        } else {
          // Add unvisited successors to the queue
          for (let successor of successors) {
            if (!visited.has(successor)) {
              queue.push(successor);
            }
          }
        }
      }

      return leafNodes;
    }

    // Assuming `trial.start` is the root node
    let root = trial.start;
    let leaf_nodes = findLeafNodes(cg.graph, root);
    
    // Highlight the leaf nodes
    for (const leaf of leaf_nodes) {
      $(`.GraphNavigation-State-${leaf}`).addClass('GraphNavigation-State-Highlighted2')
    }
    await this.button()

    this.setPrompt(`When you get to a location with no outgoing connections, the round ends.`)
    await this.button()

    this.setPrompt(`Try it now!`)

    console.log('cg.graph', cg.graph)
    await cg.navigate({n_steps: 1, leave_state: false})
    // $(`.GraphNavigation-State`).removeClass('GraphNavigation-State-Highlighted')

    // this.setPrompt(`
    //   The goal of the game is to collect points on the board.<br>
    //   Try collecting this +4!
    // `)
    // let goal = _.sample(cg.graph.successors(cg.state))
    // // $("#gn-points").show()
    // cg.setReward(goal, 4)
    // console.log('goal', goal)
    // await cg.navigate({n_steps: -1, goal, leave_state: true})

    // // this.setPrompt(`
    // //   In the non-practice games, those points will become a cash bonus!<br>
    // //   (${trial.bonus.describeScheme()})
    // // `)
    // // await this.button()

    // this.setPrompt(`
    //   Now try collecting this one.
    // `)

    // goal = _.sample(cg.graph.successors(cg.state))
    // cg.setReward(goal, -4)
    // await cg.navigate({n_steps: -1, goal, leave_open: true})

    // this.setPrompt(`
    //   <i>Ouch!</i> You lost 4 points for collecting that one!
    // `)

    cg.removeGraph()

    await this.button()
    this.runNext()
  }

  async stage_color() {

    let trial = {...this.trials.color[0], revealed: true}
    let cg = new CircleGraph(trial).attach(this.content);
    cg.showGraph()
    cg.setCurrentState(trial.start)

    this.setPrompt(`In the game, locations are maked with different colors, each representing points.`)
    await this.button()

    this.setPrompt(`Yellow locations offer positive points, while blue locations have negative points.`)
    await this.button()

    this.setPrompt(`In the non-practice games, those points will become a cash bonus!`)
    await this.button()

    this.setPrompt(`Now make a move to collect points.`)
    await cg.navigate()

    await this.button()
    this.runNext()

  }

  async stage_transition() {
    this.setPrompt(`Both the connections and points change on every round of the game.`)
    let trial = {...this.trials.vary_transition[0], revealed: true}
    cg = new CircleGraph(trial).attach(this.content);
    cg.showGraph()
    cg.setCurrentState(trial.start)
    await this.button()

    // this.setPrompt(`When you get to a location with no outgoing connections, the round ends.<br>`)
    // // let terminal = _.keys(_.pickBy(cg.graph._adjacency, _.isEmpty))
    // // for (const s of terminal) {
    // //   cg.highlight(s)
    // // }
    // await this.button()
    // // for (const s of terminal) {
    // //   cg.unhighlight(s)
    // // }

    this.setPrompt(`Try to make as many points as you can!`)
    await cg.navigate()
    this.runNext()
  }

  async stage_practice_revealed() {
    this.setPrompt("Try a few more practice rounds.")
    for (let trial of this.trials.practice_revealed) {
      let cg = new CircleGraph({...trial, revealed: true})
      await cg.run(this.content)
    }
    this.runNext()
  }

  async stage_hover() {
    this.setPrompt("Just one more thing...")
    let trial = {...this.trials.intro_hover[0], revealed: true}

    // FAST_MODE || await this.button()

    let hidden_things = "points and connections"
    // [
    //   trial._rewards && "points",
    //   trial._edges && "connections"
    // ].filter(x=>x).join(" and ")

    this.setPrompt(`So far we've been showing you all the ${hidden_things}`)
    cg = new CircleGraph(trial).attach(this.content);
    cg.showGraph()
    cg.setCurrentState(trial.start)
    FAST_MODE || await this.button()

    this.setPrompt("But in the real game, they're hidden!")
    FAST_MODE || await sleep(600)
    FAST_MODE || $('.GraphNavigation-arrow,.GraphReward,.GraphNavigation-edge').css('transition', 'opacity 1500ms')
    cg.el.classList.add('hideStates')
    cg.el.classList.add('hideEdges')
    FAST_MODE || await sleep(1500)
    $('.GraphNavigation-arrow,.GraphReward,.GraphNavigation-edge').css('transition', '')
    this.cg = cg
    this.skipNextClear()
  }

  async stage_hover_instruct() {
    let cg;
    if ($('.GraphNavigation').length && this.cg) {
      cg = this.cg
      this.cg = undefined
    } else {
      let trial = {...this.trials.intro_hover[0], revealed: false}
      cg = new CircleGraph(trial).attach(this.content);
      cg.showGraph()
      cg.setCurrentState(trial.start)
    }

    let hidden_things = "points and connections"
    if (cg.options.forced_hovers) {
      await this.forcedHoverInstructions(cg, hidden_things)
    } else {
      await this.freeHoverInstructions(cg, hidden_things)
    }
    this.runNext()
  }

  async stage_incentives() {
    // this.setPrompt(`
    //   _What's in it for me?_ you might be asking. Well, we thought of that!
    //   Unlike other experiments you might have done, we don't have a fixed number of rounds.
    // `)
    // await this.button()
    // let goal
    // if (PARAMS.time_limit) {
    //   goal = 'earn the most money'
    //   let time_limit = PARAMS.time_limit / 60
    //   this.setPrompt(`
    //     Instead, you will have **${time_limit} minutes** to collect **as many points as you can.**
    //     At the end of the experiment, we will convert those points into a cash bonus:
    //     **${this.options.bonus.describeScheme()}.**
    //   `)
    //   await this.button()
    // } else {
    //   goal = 'finish the study as quickly as possible'
    //   this.setPrompt(`
    //     Instead, you will do as **as many rounds as it takes** to earn **${PARAMS.score_limit} points.**
    //   `)
    //   await this.button()
    // }
    // this.setPrompt(`
    //   To ${goal}, you'll have to balance making fast choices and selecting the
    //   best possible path.
    // `)


    this.setPrompt(`You will have 100 rounds to collect **as many points as you can**.`)
    await this.button()
    this.runNext()
  }

  async stage_final() {
    // I suggest keeping something like this here to warn participants to not refresh

    this.setPrompt(`
      That's it! You're ready to begin the main section of the experiment.

      <br><br>
      <div class="alert alert-danger">
        <b>Warning!</b><br>
        Once you complete the instructions, <strong>you cannot refresh the page</strong>.
        If you do, you will get an error message and you won't be able to complete the
        study.
      </div>
    `)
    let question = 'Are you going to refresh the page after completing the instructions?'
    let radio = radio_buttons(this.prompt, question, ['yes', 'no'])
    let post = $('<div>').appendTo(this.prompt)
    let no = makePromise()
    let done = false
    radio.click((val) => {
      if (val == 'yes') {
        post.html("Haha... But seriously.")
      } else {
        no.resolve()
      }
    })
    await no
    radio.buttons().off()
    radio.buttons().prop('disabled', true)
    post.html('Good. No refreshing!')
    await this.button('finish instructions')
    this.runNext() // don't make them click the arrow
  }

  async forcedHoverInstructions(hidden_things) {
    this.setPrompt(`On each round, we will show you parts of the board, one at a time.`)
    await this.button()

    this.setPrompt(`Your current location will turn pink during this phase of the game.`)
    $(cg.el).addClass('forced-hovers')
    await this.button()

    this.setPrompt(`For example, here is one location you could move to from your initial location.`)
    // let hover = cg.showForcedHovers(0, 1)
    let [s1, s2] = trial.expansions[0]
    cg.showEdge(s1, s2)
    await this.button()

    this.setPrompt(`Press any key to reveal the number of points at that location.`)
    // cg.highlight(s2)
    await getKeyPress()
    this.setPrompt(`Thats it!`)

    cg.unhighlight(s2)
    cg.showState(s2)
    await this.button()

    this.setPrompt('Keep pressing a key to see more of the board.')
    cg.hideState(s2)
    cg.hideEdge(s1, s2)
    await cg.showForcedHovers(1)
    this.setPrompt(`Your current location will turn back to blue when it's time to select your moves.`)
    await this.button()
    this.setPrompt(`Good luck!`)
    cg.options.expansions = []
    await cg.navigate()
  }

  async freeHoverInstructions(cg, hidden_things) {
     this.setPrompt(`
       But don't worry! Before you select your moves, you can see the
       ${hidden_things} in <i><b>imagination mode</b></i>.
     `)
     FAST_MODE || await this.button()

     let action_text = {
      'click': 'clicking on it',
      'hover': 'hovering the mouse over it',
     }[cg.options.reveal_by]

     this.setPrompt(`
      In imagination mode, you can imagine being in any location by ${action_text}.
      This will show you the locations you could visit next from that one.
    `)
     FAST_MODE || await this.button()

     this.setPrompt(`
      Try it out! Hover over every location to continue.
    `)
     cg.plan(true)

     let setEqual = (xs, ys) => xs.size === ys.size && [...xs].every((x) => ys.has(x));
     let hovered = new Set([cg.state])
     let all_states = new Set(cg.graph.states)
     let done = false
     let reminded = false

     let hoveredAll = makePromise();

     cg.logger_callback = (event, info) => {
       if (!done && event == 'graph.imagine') {
         hovered.add(info.state)
         console.log('callback', String(info.state))
         if (cg.options.show_successor_rewards && !reminded && terminal.includes(String(info.state))) {
           this.setPrompt(`
             If nothing appears, it means that location has no outgoing connections.
             <br>
             Click on every location to continue.
           `)
         }
         if (setEqual(hovered, all_states)) {
           done = true
           hoveredAll.resolve()
         }
       }
     }
     sleep(10000).then(() => {
      reminded = true
      let action_text = {
       'click': 'Click on',
       'hover': 'Hover the mouse over',
      }[cg.options.reveal_by]
       if (done) return
       this.setPrompt(`
         <b>${action_text} every location to continue!</b><br>
       `)
     })
     await hoveredAll

     this.setPrompt(`
       When you're ready to select your moves, click on your current location (the red one).
    `)
     await cg.enableExitImagination()
     this.setPrompt(`
       Try to get as many points as you can!
    `)
     await cg.navigate()
  }
}