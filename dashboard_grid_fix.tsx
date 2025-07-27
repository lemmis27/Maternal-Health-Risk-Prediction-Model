// Grid Layout Implementation for Pregnant Mother Dashboard
// Using CSS Grid with Box components to avoid Material-UI Grid TypeScript issues

{/* Main Container with CSS Grid */}
<Container maxWidth="xl">
  <Box sx={{ display: 'grid', gap: 3 }}>
    
    {/* Header Section - Full Width */}
    <Box>
      <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        {/* Header content */}
      </Card>
    </Box>

    {/* Quick Status Cards - Responsive Grid */}
    <Box sx={{ 
      display: 'grid', 
      gridTemplateColumns: { 
        xs: '1fr', 
        sm: 'repeat(2, 1fr)', 
        md: 'repeat(3, 1fr)' 
      },
      gap: 3 
    }}>
      <Card sx={{ height: '100%' }}>
        {/* Latest Risk Assessment */}
      </Card>
      <Card sx={{ height: '100%' }}>
        {/* Health Status */}
      </Card>
      <Card sx={{ height: '100%' }}>
        {/* Next Appointment */}
      </Card>
    </Box>

    {/* Vital Signs - 4 Column Grid */}
    <Box sx={{ 
      display: 'grid', 
      gridTemplateColumns: { 
        xs: 'repeat(2, 1fr)', 
        sm: 'repeat(4, 1fr)' 
      },
      gap: 2 
    }}>
      <Card>{/* Blood Pressure */}</Card>
      <Card>{/* Heart Rate */}</Card>
      <Card>{/* Blood Sugar */}</Card>
      <Card>{/* Body Temperature */}</Card>
    </Box>

    {/* Assessment History Chart - Full Width */}
    <Box>
      <Card>
        {/* Chart content */}
      </Card>
    </Box>

    {/* AI Assistants & Quick Actions - 2 Column Grid */}
    <Box sx={{ 
      display: 'grid', 
      gridTemplateColumns: { 
        xs: '1fr', 
        md: 'repeat(2, 1fr)' 
      },
      gap: 3 
    }}>
      <Card sx={{ height: '100%' }}>
        {/* AI Health Assistants */}
      </Card>
      <Card sx={{ height: '100%' }}>
        {/* Quick Actions */}
      </Card>
    </Box>

    {/* Assessment History Table - Full Width */}
    <Box>
      <Card>
        {/* Table content */}
      </Card>
    </Box>

    {/* Health Tips & Emergency Info - 2 Column Grid */}
    <Box sx={{ 
      display: 'grid', 
      gridTemplateColumns: { 
        xs: '1fr', 
        lg: '2fr 1fr' 
      },
      gap: 3 
    }}>
      <Card>
        {/* Health Tips */}
      </Card>
      <Card sx={{ border: '2px solid #f44336' }}>
        {/* Emergency Information */}
      </Card>
    </Box>

  </Box>
</Container>