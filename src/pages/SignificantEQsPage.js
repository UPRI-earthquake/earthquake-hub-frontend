import Header from "../components/Header";
import Card from "../components/Card";
import './SignificantEQsPage.css';

function App() {
  const cardsData = [
    { title: 'Magnitude 7.1 Earthquake in Sultan Kudarat', magnitude: '7.1', location: '99 km S 72° W of Palimbang (Sultan Kudarat)', date: '11 July 2024', time: '10:13 AM', 
      description: 'Caused extensive structural damage to buildings, leading to collapsed walls, cracked foundations, and compromised safety. Infrastructure such as roads and bridges suffered significant disruption, impeding emergency response and daily commutes.' },
    { title: 'Magnitude 7.1 Earthquake in Sultan Kudarat', magnitude: '7.1', location: '99 km S 72° W of Palimbang (Sultan Kudarat)', date: '11 July 2024', time: '10:13 AM', 
      description: 'Caused extensive structural damage to buildings, leading to collapsed walls, cracked foundations, and compromised safety. Infrastructure such as roads and bridges suffered significant disruption, impeding emergency response and daily commutes.' },
    { title: 'Magnitude 7.1 Earthquake in Sultan Kudarat', magnitude: '7.1', location: '99 km S 72° W of Palimbang (Sultan Kudarat)', date: '11 July 2024', time: '10:13 AM', 
      description: 'Caused extensive structural damage to buildings, leading to collapsed walls, cracked foundations, and compromised safety. Infrastructure such as roads and bridges suffered significant disruption, impeding emergency response and daily commutes.' },
    { title: 'Magnitude 7.1 Earthquake in Sultan Kudarat', magnitude: '7.1', location: '99 km S 72° W of Palimbang (Sultan Kudarat)', date: '11 July 2024', time: '10:13 AM', 
      description: 'Caused extensive structural damage to buildings, leading to collapsed walls, cracked foundations, and compromised safety. Infrastructure such as roads and bridges suffered significant disruption, impeding emergency response and daily commutes.' },
    { title: 'Magnitude 7.1 Earthquake in Sultan Kudarat', magnitude: '7.1', location: '99 km S 72° W of Palimbang (Sultan Kudarat)', date: '11 July 2024', time: '10:13 AM', 
      description: 'Caused extensive structural damage to buildings, leading to collapsed walls, cracked foundations, and compromised safety. Infrastructure such as roads and bridges suffered significant disruption, impeding emergency response and daily commutes.' },
    { title: 'Magnitude 7.1 Earthquake in Sultan Kudarat', magnitude: '7.1', location: '99 km S 72° W of Palimbang (Sultan Kudarat)', date: '11 July 2024', time: '10:13 AM', 
      description: 'Caused extensive structural damage to buildings, leading to collapsed walls, cracked foundations, and compromised safety. Infrastructure such as roads and bridges suffered significant disruption, impeding emergency response and daily commutes.' },
    { title: 'Magnitude 7.1 Earthquake in Sultan Kudarat', magnitude: '7.1', location: '99 km S 72° W of Palimbang (Sultan Kudarat)', date: '11 July 2024', time: '10:13 AM', 
      description: 'Caused extensive structural damage to buildings, leading to collapsed walls, cracked foundations, and compromised safety. Infrastructure such as roads and bridges suffered significant disruption, impeding emergency response and daily commutes.' },
  ];

  return (
    <div className="App">
      {console.log('render app screen')}
        <Header />
        <div className="App-body">
          <div className="content-container">
            <h1>Significant Earthquakes</h1>
            <div className="cards-container">
              {cardsData.map((card, index) => (
                <Card key={index} title={card.title} magnitude={card.magnitude} location={card.location} date={card.date} time={card.time} description={card.description} />
              ))}
          </div>
          </div>
        </div>
    </div>
  );
}

export default App;
