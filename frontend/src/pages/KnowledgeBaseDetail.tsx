import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Tabs,
  Tab,
  Button,
  AppBar,
  Toolbar,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { knowledgeBaseApi, KnowledgeBase } from '../services/api';
import DocumentManager from '../components/DocumentManager';
import Playground from '../components/Playground';
import TestCaseManager from '../components/TestCaseManager';
import EvaluationList from '../components/EvaluationList';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function KnowledgeBaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    loadKnowledgeBase();
  }, [id]);

  const loadKnowledgeBase = async () => {
    if (!id) return;
    try {
      const response = await knowledgeBaseApi.get(id);
      setKb(response.data);
    } catch (error) {
      console.error('Failed to load knowledge base:', error);
    }
  };

  if (!kb || !id) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Button color="inherit" startIcon={<ArrowBack />} onClick={() => navigate('/')}>
            Back
          </Button>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, ml: 2 }}>
            {kb.name}
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label="Documents" />
            <Tab label="Playground" />
            <Tab label="Test Cases" />
            <Tab label="Evaluations" />
          </Tabs>
        </Box>

        <TabPanel value={tab} index={0}>
          <DocumentManager kbId={id} />
        </TabPanel>

        <TabPanel value={tab} index={1}>
          <Playground kbId={id} />
        </TabPanel>

        <TabPanel value={tab} index={2}>
          <TestCaseManager kbId={id} />
        </TabPanel>

        <TabPanel value={tab} index={3}>
          <EvaluationList kbId={id} />
        </TabPanel>
      </Container>
    </>
  );
}
